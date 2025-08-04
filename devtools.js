// To debug, run with chromium --enable-logging=stderr --v=0

function recordSelectorsToRFSelector(selectors, options) {
  // Selectors may be a list of items to reach the ancestor first. We don't support this format, but
  // anyway it seems that it is not really used for now.
  const selectorsSimple = selectors.filter(x => typeof x === "string" || x.length == 1).map(x => typeof x === "string" ? x : x[0]);
  const cssSelector = selectorsSimple.filter(s => !s.startsWith("aria/") && !s.startsWith("xpath/")).map(s => s.startsWith("pierce/") ? s.slice(7) : s);
  const cssSelectorWithName = cssSelector.filter(x => x.match(/name=/));
  // We prefer to have [name="email"] than a poorly translated Aria selector
  if (cssSelectorWithName.length > 0) {
    return cssSelectorWithName[0]
  }
  // Aria are not really supported with text selector in playwright, and role selector requires the type
  // of the element which is missing here. So we try to convert it to text if the user wants it…
  function dealWithAriaText() {
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
    return cssSelector[0]
  } else {
    const xpathSelector = selectorsSimple.filter(s => s.startsWith("xpath/")).map(s => s.slice(6));
    if (xpathSelector.length > 0) {
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

class RobotFrameworkRecorder {
  constructor(options) {
    this.options = options || {};
  }
  stringify(recording) {
    return (
      "*** Settings ***\n"
      + "Library    Browser\n\n"
      + "*** Test Cases ***\n"
      + `${recording.title}\n`
      + "    New Browser    chromium    headless=false\n"
      + (recording?.selectorAttribute === undefined ?
         "    # WARNING: To have more robust selectors, we recommend you set 'name' as the 'selector attribute' when starting the recording,\n" +
         "    # since, e.g. '[name=Login]' is less subject to change than 'label:nth-of-type(1) > input'\n" : "")
      + recording.steps.filter(st => st.type !== "setViewport").map(
        step => `    ${this.stringifyStep(step)}`
      ).join('\n')
    );
  }
  stringifyStep(step) {
    switch (step.type) {
      case "click":
        return `Click  ${recordSelectorsToRFSelector(step.selectors, this.options)}`;
      case "change":
        return `Fill Text  ${recordSelectorsToRFSelector(step.selectors, this.options)}  ${step.value}`;
      case "navigate":
        return `New Page  ${step.url}`;
      case "hover":
        return `Hover  ${recordSelectorsToRFSelector(step.selectors, this.options)}`;
      case "doubleClick":
        return `Click With Options  ${recordSelectorsToRFSelector(step.selectors, this.options)}  clickCount=2`;
      case "keyDown":
        return `Keyboard Key  down  ${step.key}`;
      case "keyUp":
        return `Keyboard Key  up  ${step.key}`;
      case "waitForElement":
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
