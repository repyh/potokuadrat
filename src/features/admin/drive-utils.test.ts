import { describe, expect, it } from "vitest";
import { extractDriveFolderId, isValidDriveFolderId } from "./drive-utils";

describe("Google Drive URL & ID Parser", () => {
  it("extracts folder id from standard Google Drive URL", () => {
    const url = "https://drive.google.com/drive/folders/1XtiPMDZ5FWFJv8IqWNjnZDqwJD9LmURQ";
    expect(extractDriveFolderId(url)).toBe("1XtiPMDZ5FWFJv8IqWNjnZDqwJD9LmURQ");
  });

  it("extracts folder id from account-scoped Google Drive URL", () => {
    const url = "https://drive.google.com/drive/u/0/folders/1abcDEF-ghi_JKL1234567890?usp=sharing";
    expect(extractDriveFolderId(url)).toBe("1abcDEF-ghi_JKL1234567890");
  });

  it("extracts folder id from query parameter link", () => {
    const url = "https://drive.google.com/open?id=1AbCdEfGhIjKlMnOpQrStUvWxYz";
    expect(extractDriveFolderId(url)).toBe("1AbCdEfGhIjKlMnOpQrStUvWxYz");
  });

  it("returns trimmed raw string when plain ID is passed", () => {
    const raw = "   1XtiPMDZ5FWFJv8IqWNjnZDqwJD9LmURQ   ";
    expect(extractDriveFolderId(raw)).toBe("1XtiPMDZ5FWFJv8IqWNjnZDqwJD9LmURQ");
  });

  it("validates Google Drive folder ID format correctly", () => {
    expect(isValidDriveFolderId("1XtiPMDZ5FWFJv8IqWNjnZDqwJD9LmURQ")).toBe(true);
    expect(isValidDriveFolderId("short")).toBe(false);
    expect(isValidDriveFolderId("invalid$character!")).toBe(false);
    expect(isValidDriveFolderId("")).toBe(false);
  });
});
