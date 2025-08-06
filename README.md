# Robot Framework Recorder

This open source Chrome/Chromium extension allows you to record clicks/keyboard entries/… within your browser, and export them as a [Robot Framework](https://robotframework.org/) script (supporting both the Browser and Selenium libraries, even if Selenium is more experimental), like:

```
*** Settings ***
Library    Browser

*** Test Cases ***
My first test
    New Browser    chromium    headless=false
    New Page  https://yourwebsite
    Click  [name='username']
    Fill Text  [name='username']  me
    Click  [name='password']
    Fill Text  [name='password']  my password
    Click  "Login"
```

**Disclaimer**: this library has not been tested extensively. Please report bugs in https://github.com/leo-colisson/robotframework-recorder/issues and feel free to send pull requests to our repository https://github.com/leo-colisson/robotframework-recorder.

If you like this open source app (MIT licensed) developed in my free time and want to support it and its fees (e.g. I needed to pay to add it to the Chrome store), please make a donation at https://github.com/sponsors/tobiasBora 

## Usage

1. Install this extension (from Chrome's store or see also the Get involved section)
2. Open DevTools (F12, or Ctrl-Shift-I, or via the menu…)
3. Go to the "Recorder" tab, if it does not appear you can also open it via the `3 dots > More tools > Recorder`.
4. Click "Create a new recording"
5. Give it a name, and we also **recommend to set `name` in the "selector attribute" field** to get more stable locator (see the "Know issues and workarounds" section below for details)
6. Click "Start recording"
7. Perform in the browser the actions you want to record (fill form, click buttons…)
8. Click "End recording"
9. You can then get the generated script either by clicking `Show Code` at the top right of the recording (to copy/paste), or via the `Export` button (to download a file). You have a list of available exporters, and this library adds (for now) 2 exporters:
   - `RobotFrameworkRecorder (Browser, no aria)`
   - `RobotFrameworkRecorder (Browser, aria as text)`
   - `RobotFrameworkRecorder (Selenium)`
   The first two exporters target the `Browser` library, the main differences between them is that the `aria as text` variant will try to generate when possible things like `Click  "your text"` instead of `Click  label:nth-of-type(1) > input`. This is of course more readable, but we sadly cannot guarantee here that the selector will always work (though it should fail quite rarely, see "Know issues and workarounds" for details). The exporter `RobotFrameworkRecorder (Selenium)` targets the `SeleniumLibrary` library. Since, to the best of our knowledge, it does not support selecting by text, only CSS and XPath selectors are supported.
   
This script can then simply be called by robot framework, after installing the [`robotframework-browser` library](https://robotframework-browser.org/).

## Known issues and workarounds

- To have more robust locators (like `[name='password']` instead of `label:nth-of-type(1) > input`), for now you need to set `name` in the "selector attribute" field when starting the recording. This is needed until Chrome fixes [this issue](https://issues.chromium.org/issues/434983804).
- ARIA support: Due to [this same Chrome issue](https://issues.chromium.org/issues/434983804), we cannot use the ARIA entries to their full power since the name of the role is not recorded by Chromium and Playwright requires the name of the role (see bug reported [here](https://github.com/microsoft/playwright/issues/36858)). If you choose the `aria as text` flavor of the exporter, and encounter a locator like `aria/Login` we will try to convert it to `Text  "Login"`. In my tests it works fairly well, but I can't guarantee that it will always work, hence the other flavor.
- For now we only support actions (clicks, keyboard inputs…), and waiting for element to appear in the DOM, but I've not implemented more advanced tests (count…) since I don't need them. It is however fairly easy to implement though, so feel free to request/implement it if needed and create a pull request.
- The Selenium library does not support some key down functions (e.g. media keys) and it is not possible to press a key, do an action, and release it, due to Selenium's API. More generally, Selenium's implementation has been poorly tested since I don't use it, so report any bug in https://github.com/leo-colisson/robotframework-recorder/issues.

## Get involved

If you want to get involved into the project, clone this project, and install the local version by going to `Chrome > My Extensions > Developer mode (top right switch) > Load Unpacked Extension` and browse to your clone folder. That's it, to reload the library just close and re-open the DevTools. Most of the interesting code is in `devtools.js`, just edit it to your need and feel free to submit a Pull Request if it may help others!

