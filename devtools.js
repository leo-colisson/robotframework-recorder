// To debug, run with chromium --enable-logging=stderr --v=0

function recordSelectorsToRFSelector(selectors, options) {
  // Selectors may be a list of items to reach the ancestor first. We don't support this format, but
  // anyway it seems that it is not really used for now.
  const selectorsSimple = selectors.filter(x => typeof x === "string" || x.length == 1).map(x => typeof x === "string" ? x : x[0]);
  const cssSelector = selectorsSimple.filter(s => !s.startsWith("aria/") && !s.startsWith("xpath/")).map(s => s.startsWith("pierce/") ? s.slice(7) : s);
  const cssSelectorWithName = cssSelector.filter(x => x.match(/name=/));
  // We prefer to have [name="email"] than a poorly translated Aria selector
  if (cssSelectorWithName.length > 0) {
    if(options?.selenium) {
      return `css:${cssSelectorWithName[0]}`
    }
    return cssSelectorWithName[0]
  }
  // Aria are not really supported with text selector in playwright, and role selector requires the type
  // of the element which is missing here. So we try to convert it to text if the user wants it…
  function dealWithAriaText() {
    // The selenium library does not support aria/text selection
    // https://robotframework.org/SeleniumLibrary/SeleniumLibrary.html#Locating%20elements
    if(options?.selenium) {
      return null
    }
    const ariaSelector = selectorsSimple.filter(s => s.match(/^aria\/[A-Za-z \u00C0-\u017F]+$/)).map(s => s.slice(5));
    if (ariaSelector.length > 0) {
      return `"${ariaSelector[0]}"`;
    }
    const textSelector = selectorsSimple.filter(s => s.startsWith("text/")).map(s => s.slice(5));
    if (textSelector.length > 0) {
      return `"${textSelector[0]}"`;
    }
    return null
  }
  if (options?.aria_as_text) {
    const r = dealWithAriaText();
    if (r !== null) {
      return r
    }
  }
  if (cssSelector.length > 0) {
    if(options?.selenium) {
      return `css:${cssSelector[0]}`
    }
    return cssSelector[0]
  } else {
    const xpathSelector = selectorsSimple.filter(s => s.startsWith("xpath/")).map(s => s.slice(6));
    if (xpathSelector.length > 0) {
      if(options?.selenium) {
        return `xpath:${xpathSelector[0]}`
      }
      return xpathSelector[0]
    } else {
      const r = dealWithAriaText();
      if (r !== null) {
        return r
      }
      return `# ERROR: No valid selector found in ${selectors}`
    }
  }
}

function toSeleniumKey(key) {
  // https://pptr.dev/api/puppeteer.keyinput
  // https://www.selenium.dev/selenium/docs/api/py/webdriver/selenium.webdriver.common.keys.html
  if (key.match(/^[a-zA-Z0-9]$/)) {
    return key
  }

  if ([";", "=", ",", ".", "`", "[", "\\", "]", "'", "(", ")", "!", "@", "#", "%", "^", "&", ":", "<", ">", "?", "~", "{", "}", "\"", "_", "|"].includes(key)) {
    return key
  }
  
  if ([
    "Cancel",
    "Help",
    "Backspace",
    "Tab",
    "Clear",
    "Enter",
    "Pause",
    "Escape",
    "Space",
    "End",
    "Home",
    "Insert",
    "Delete",
    "Semicolon",
    "Shift",
    "Control",
    "Alt",
    "Meta",
  ].includes(key)) {
    return key.toUpperCase();
  }

  if(key.match(/^Numpad[0-9]$/)) {
    return key.toUpperCase();
  }

  if(key.match(/^Digit[0-9]$/)) {
    // Possibly not equivalent, but not sure if selenium has a better translation
    return key.replace("Digit", "NUMPAD");
  }

  if(key.match(/^Key[a-zA-Z]$/)) {
    return key.replace("Key", "");
  }

  if(key.match(/^F[0-9]+$/)) {
    return key;
  }

  switch (key) {
    case "\\r":
      return "RETURN"
    case "\\n":
      return "ENTER"
    case "\\u0000":
      return "NULL"
    case "NumpadEnter":
      return "ENTER"
    case "ShiftLeft":
      return "LEFT_SHIFT"
    case "ShiftRight":
      return "RIGHT_SHIFT"
    case "ControlLeft":
      return "LEFT_CONTROL"
    case "ControlRight":
      return "RIGHT_CONTROL"
    case "AltLeft":
      return "LEFT_ALT"
    case "AltRight":
      return "RIGHT_ALT"
    case "MetaLeft":
      return "LEFT_META"
    case "MetaRight":
      return "RIGHT_META"
    case "PageUp":
      return "PAGE_UP"
    case "PageDown":
      return "PAGE_DOWN"
    case "ArrowLeft":
      return "ARROW_LEFT"
    case "ArrowUp":
      return "ARROW_UP"
    case "ArrowRight":
      return "ARROW_RIGHT"
    case "ArrowDOWN":
      return "ARROW_DOWN"
    case "NumpadDecimal":
    case "Period":
      return "DECIMAL"
    case "NumpadMultiply":
    case "*":
      return "MULTIPLY"
    case "NumpadAdd":
    case "+":
      return "ADD"
    case "NumpadSubstract":
    case "Minus":
    case "-":
      return "SUBSTRACT"
    case "NumpadDivide":
    case "Slash":
    case "/":
      return "DIVIDE"
    case "Equal":
    case "NumpadEqual":
      return "EQUALS"
    case " ":
      return "SPACE"
    case "Comma":
      return ","
    default:
      return `# Key ${key} not supported by selenium`
  }
}

function groupKeysForSelenium(steps) {
  // Selenium does not support key up/key down separately, instead it presses all keys together.
  // Hence we group all keys for selenium
  if (steps.length <= 1) {
    return steps
  } else {
    const next_steps = groupKeysForSelenium(steps.slice(1));
    if (steps[0].type === "keyDown" && next_steps[0].type === "keyDown") {
      return [{
        "type": "keyDown",
        key: [steps[0].key].concat(typeof next_steps[0].key === "string" ? [next_steps[0].key] : next_steps[0].key)
      }].concat(next_steps.slice(1))
    } else {
      return [steps[0]].concat(next_steps)
    }
  }
}

class RobotFrameworkRecorder {
  constructor(options) {
    this.options = options || {};
  }
  stringify(recording) {
    const options = this.options;
    const steps = this.options?.selenium
                ? groupKeysForSelenium(recording.steps.filter(st => st.type !== "setViewport")).filter(st => st.type !== "keyUp")
                : recording.steps.filter(st => st.type !== "setViewport");
    return (
      "*** Settings ***\n"
      + (options?.selenium ? "Library    SeleniumLibrary\n\n" : "Library    Browser\n\n")
      + "*** Test Cases ***\n"
      + `${recording.title}\n`
      + (options?.selenium ? "    Open Browser\n" : "    New Browser    chromium    headless=false\n")
      + (recording?.selectorAttribute === undefined ?
         "    # WARNING: To have more robust selectors, we recommend you set 'name' as the 'selector attribute' when starting the recording,\n" +
         "    # since, e.g. '[name=Login]' is less subject to change than 'label:nth-of-type(1) > input'\n" : "")
      + steps.map(step => `    ${this.stringifyStep(step)}`).join('\n')
    );
  }
  stringifyStep(step) {
    const options = this.options;
    switch (step.type) {
      case "click":
        if(options?.selenium) {
          return `Click Element  ${recordSelectorsToRFSelector(step.selectors, this.options)}`;
        }        
        return `Click  ${recordSelectorsToRFSelector(step.selectors, this.options)}`;
      case "change":
        if(options?.selenium) {
          return `Input Text  ${recordSelectorsToRFSelector(step.selectors, this.options)}  ${step.value}`;
        }        
        return `Fill Text  ${recordSelectorsToRFSelector(step.selectors, this.options)}  ${step.value}`;
      case "navigate":
        if(options?.selenium) {
          return `Go To  ${step.url}`;
        }
        return `New Page  ${step.url}`;
      case "hover":
        if(options?.selenium) {
          return `Mouse Over  ${recordSelectorsToRFSelector(step.selectors, this.options)}`;
        }
        return `Hover  ${recordSelectorsToRFSelector(step.selectors, this.options)}`;
      case "doubleClick":
        if(options?.selenium) {
          return `Click Element  ${recordSelectorsToRFSelector(step.selectors, this.options)}`;
        }
        return `Click With Options  ${recordSelectorsToRFSelector(step.selectors, this.options)}  clickCount=2`;
      case "keyDown":
        if(options?.selenium) {
          const keysStr = typeof step.key === "string" ? toSeleniumKey(step.key) : step.key.map(k => toSeleniumKey(k)).join('+');
          return `Press Keys  None  ${keysStr}`;
        }
        return `Keyboard Key  down  ${step.key}`;
      case "keyUp":
        if(options?.selenium) {
          return `# With the Selenium library, it is not possible to release a key (here ${step.key}), instead the above "Press Keys" should both press the key and release it, but you may need to fine tune it if multiple keys are pressed at the same time`;
        }
        return `Keyboard Key  up  ${step.key}`;
      case "waitForElement":
        if(options?.selenium) {
          return `Wait Until Page Contains Element  ${recordSelectorsToRFSelector(step.selectors, this.options)}`
        }
        return `Wait For Elements State  ${recordSelectorsToRFSelector(step.selectors, this.options)}  attached`;
      default:
        return `# Unknown step type ${step.type}${step?.selectors ? " on selector: " + recordSelectorsToRFSelector(step.selectors, this.options) : ""}`;
    };
  }
}

chrome.devtools.recorder.registerRecorderExtensionPlugin(
  new RobotFrameworkRecorder(),
  'RobotFrameworkRecorder (Browser, no aria)',
  'application/text'
);

chrome.devtools.recorder.registerRecorderExtensionPlugin(
  new RobotFrameworkRecorder({
    aria_as_text: true,
  }),
  'RobotFrameworkRecorder (Browser, aria as text)',
  'application/text'
);

chrome.devtools.recorder.registerRecorderExtensionPlugin(
  new RobotFrameworkRecorder({
    selenium: true,
  }),
  'RobotFrameworkRecorder (Selenium)',
  'application/text'
);
