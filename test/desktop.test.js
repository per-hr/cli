import { test } from "node:test";
import assert from "node:assert/strict";
import { desktopOs, desktopPlan, looksRight, versionFromPlist, versionFromRegistry } from "../lib/desktop.js";

const REG = [
  "HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Studio Lark Notes",
  "    DisplayName    REG_SZ    Studio Lark Notes",
  "    DisplayVersion    REG_SZ    3.1.0",
  "",
  "HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\per.hr",
  "    DisplayName    REG_SZ    per.hr",
  "    DisplayVersion    REG_SZ    0.2.0",
  "    Publisher    REG_SZ    per.hr",
  "",
].join("\r\n");

test("the installed version on Windows, from the uninstall entries", () => {
  assert.equal(versionFromRegistry(REG), "0.2.0");
  assert.equal(versionFromRegistry(REG.replace("    DisplayVersion    REG_SZ    0.2.0\r\n", "")), "");
  assert.equal(versionFromRegistry(REG.replace(/DisplayName    REG_SZ    per\.hr/, "DisplayName    REG_SZ    per.hr helper")), null);
  assert.equal(versionFromRegistry(""), null);
});

test("the installed version on a Mac, from Info.plist", () => {
  assert.equal(versionFromPlist("<dict><key>CFBundleShortVersionString</key>\n  <string>0.2.0</string></dict>"), "0.2.0");
  assert.equal(versionFromPlist("<dict></dict>"), null);
});

test("install, update, or leave it", () => {
  assert.equal(desktopPlan(null, "0.2.0"), "install");
  assert.equal(desktopPlan("0.1.0", "0.2.0"), "update");
  assert.equal(desktopPlan("0.2.0", "0.2.0"), "current");
  assert.equal(desktopPlan("0.3.0", "0.2.0"), "current");
  assert.equal(desktopPlan("0.2.0", "0.2.0", true), "reinstall");
  assert.equal(desktopPlan("", "0.2.0"), "update");
});

test("systems and installer bytes", () => {
  assert.equal(desktopOs("win32"), "windows");
  assert.equal(desktopOs("darwin"), "mac");
  assert.equal(desktopOs("linux"), null);
  assert.equal(looksRight("windows", Buffer.from("MZ")), true);
  assert.equal(looksRight("windows", Buffer.from("<h")), false);
  assert.equal(looksRight("mac", Buffer.from("x")), true);
});
