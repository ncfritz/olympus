import { describe, expect, it } from "vitest";
import {
  episodeLibraryPath,
  movieLibraryPath,
} from "../../../../src/media/planning/libraryPath";

describe("movieLibraryPath", () => {
  it("files a movie under its initial with its year", () => {
    expect(
      movieLibraryPath({ title: "heat", releaseDate: "1995-12-15" }),
    ).toEqual({ path: "/Movies/H", fileName: "heat (1995).mp4" });
  });

  it("files titles that start with a digit or symbol under 0-9", () => {
    expect(
      movieLibraryPath({ title: "12 Angry Men", releaseDate: "1957-04-10" })
        .path,
    ).toBe("/Movies/0-9");
  });

  it("keeps the extension when the movie has no release date", () => {
    expect(movieLibraryPath({ title: "Untitled", releaseDate: null })).toEqual({
      path: "/Movies/U",
      fileName: "Untitled.mp4",
    });
  });

  it("replaces slashes and squeezes spaces in the file name", () => {
    expect(
      movieLibraryPath({ title: "Face/Off  Again", releaseDate: "1997-06-27" })
        .fileName,
    ).toBe("Face -Off Again (1997).mp4");
  });
});

describe("episodeLibraryPath", () => {
  it("files an episode under its series and season", () => {
    expect(
      episodeLibraryPath(
        { name: "The Wire", firstAirDate: "2002-06-02" },
        { seasonNumber: 1, episodeNumber: 3, name: "The Buys" },
      ),
    ).toEqual({
      path: "/TV Series/The Wire/Season 01",
      fileName: "The Wire (2002) - s01e03 - The Buys.mp4",
    });
  });

  it("leaves the year out when the series has no air date", () => {
    expect(
      episodeLibraryPath(
        { name: "Pilot Season", firstAirDate: null },
        { seasonNumber: 12, episodeNumber: 104, name: "Finale" },
      ).fileName,
    ).toBe("Pilot Season - s12e104 - Finale.mp4");
  });
});
