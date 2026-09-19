import moment from "moment";

/** Where a transcoded file goes in the library. */
export type LibraryPath = {
  /** Directory, e.g. `/Movies/A`. */
  path: string;
  fileName: string;
};

export type LibraryMovie = { title: string; releaseDate?: string | null };

export type LibrarySeries = { name: string; firstAirDate?: string | null };

export type LibraryEpisode = {
  seasonNumber: number;
  episodeNumber: number;
  name: string;
};

const pad = (n: number) => n.toString().padStart(2, "0");

const sanitize = ({ path, fileName }: LibraryPath): LibraryPath => ({
  path: path.trim(),
  fileName: fileName.replace(/\//g, " -").replace(/\s+/g, " ").trim(),
});

/** `/Movies/<initial or 0-9>/<Title> (<year>).mp4`. */
export const movieLibraryPath = (movie: LibraryMovie): LibraryPath => {
  const year = movie.releaseDate ? moment(movie.releaseDate).year() : undefined;
  const fileName = `${movie.title}${year ? ` (${year})` : ""}.mp4`;
  const path = /^[a-z]/i.test(fileName)
    ? `/Movies/${fileName[0].toUpperCase()}`
    : "/Movies/0-9";

  return sanitize({ path, fileName });
};

/**
 * `/TV Series/<Series>/Season <nn>/<Series> (<year>) - s<nn>e<nn> - <Episode>.mp4`.
 */
export const episodeLibraryPath = (
  series: LibrarySeries,
  episode: LibraryEpisode,
): LibraryPath => {
  const year = series.firstAirDate
    ? moment(series.firstAirDate).year()
    : undefined;
  const fileName = `${series.name}${year ? ` (${year})` : ""} - s${pad(
    episode.seasonNumber,
  )}e${pad(episode.episodeNumber)} - ${episode.name}.mp4`;
  const path = `/TV Series/${series.name}/Season ${pad(episode.seasonNumber)}`;

  return sanitize({ path, fileName });
};
