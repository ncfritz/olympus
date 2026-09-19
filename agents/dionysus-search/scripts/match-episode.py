import os
import re
import string
import sys
import json
import shutil
import datetime
import requests

from pathlib import Path

hasura_endpoint = "http://snowball.desktop.ncfritz.net:8080//v1/graphql"
hasura_headers = {
    "x-hasura-admin-secret": "admin",
    "Content-Type": "application/json"
}
def create_asset(sha, asset_type, duration, file_path, height, media_id, new_size, original_size, width):
    mutation = """
      mutation m {{
        insert_dionysus_media_asset_one(
          object: {{
            assetSha: "{}", 
            assetType: "{}", 
            duration: {}, 
            filePath: "{}", 
            height: {}, 
            mediaId: {}, 
            newSize: {}, 
            originalSize: {}, 
            width: {}
          }}
        ) {{
          mediaId
        }}
      }}
    """.format(sha, asset_type, duration, file_path, height, media_id, new_size, original_size, width)

    response = requests.post(
        hasura_endpoint,
        json={'query': mutation},
        headers=hasura_headers
    )

    if response.status_code == 200:
        return response.json()

    return None


def search_by_title(series, season, episode):
    query = f"""
      query q {{
        dionysus_tv_episodes(
          where: {{
            _and: {{
              episodeNumber: {{_eq: {episode}}},
              seasonNumber: {{_eq: {season}}}, 
              series: {{name: {{_ilike: "%{series}%"}}
            }}
          }}
        }}) {{
          id
          seasonNumber
          episodeNumber
          name
          series {{
            name
            firstAirDate
          }}
        }}
      }}
    """

    response = requests.post(
        hasura_endpoint,
        json={'query': query},
        headers=hasura_headers
    )

    if response.status_code == 200:
        return response.json()

    return None


def prompt_nuber(min, max):
    while True:
        try:
            raw_input = input("Result ID ('skip' to skip) [0]: ")

            if raw_input.strip().lower() == "skip":
                return None

            if raw_input is None or raw_input.strip() == "":
                return 0

            user_input = int(raw_input.strip())

            if user_input <= max or user_input >= min:
                return user_input
            else:
                print("Result ID is out of range.")

        except ValueError:
            print("Please enter a whole number.")


files = Path("/Users/ncfritz/Temp/dionysus/ffprobe/tv_episodes").iterdir()
#regex = re.compile(r"(.+)\s?\((\d{4})\)\s?-\s?[sS](\d\d)[eE](\d\d)\s-\s?.+", flags=re.MULTILINE | re.UNICODE)
regex = re.compile(r"(.+)\s?-\s?[sS](\d\d)[eE](\d\d).+", flags=re.MULTILINE | re.UNICODE)

for file in files:
    title_parts = regex.match(file.name)
    file_base_name = file.stem

    if title_parts is None:
        print("{} did not match title regex - skipping".format(file))
        continue

    series = title_parts.group(1).strip()
    #year = title_parts.group(2).strip()
    year = "unknown"
    season = title_parts.group(2).strip()
    episode = title_parts.group(3).strip()

    #search_series = series
    search_series = input(f"\n{series} s{season}e{episode}: ").strip().lower()

    if not os.path.exists(f"/Users/ncfritz/Temp/dionysus/sha/tv_episodes/{file_base_name}.sha"):
        print(f"SHA for {file_base_name} not found - skipping")
        continue
    else:
        with open(f"/Users/ncfritz/Temp/dionysus/sha/tv_episodes/{file_base_name}.sha", "r") as s:
            sha = s.read().strip()

    raw_results = search_by_title(search_series, int(season), int(episode))["data"]["dionysus_tv_episodes"]
    #results = [result for result in raw_results if result["series"]["name"] == series]
    results = raw_results

    if len(results) == 0:
        print("No results found for {} ({}) s{}e{}".format(series, year, season, episode))
        continue

    air_date = datetime.datetime.fromisoformat(results[0]["series"]["firstAirDate"]) if results[0]["series"]["firstAirDate"] is not None else None

    exact_match = False

    with open(file, "r") as f:
        metadata = json.load(f)

        if not "streams" in metadata:
            print("No streams found in metadata - skipping")
            continue

        width = metadata["streams"][0]["width"]
        height = metadata["streams"][0]["height"]
        size = metadata["format"]["size"]
        duration = int(float(metadata["format"]["duration"]) * 1000)
        duration_min = int(duration / 1000 / 60)
        file_name = metadata["format"]["filename"]

    media_id = None

    if (len(results) == 1 and results[0]["series"]["name"] == series and
        #air_date.year == int(year) and
        results[0]["seasonNumber"] == int(season) and
        results[0]["episodeNumber"] == int(episode)
    ):
        print("Exact match found for {} ({}) s{}e{}".format(series, year, season, episode))
        media_id = int(results[0]["id"])
        exact_match = True
    else:
        print(f"{series} ({year}) - s{season}e{episode} - {file_name}")
        print("==============================================================================================================================================================================================")
        print("Result  First Air Date            Year            Season          Episode     Series                                           Episode Name")
        print("----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------")

        for i, result in enumerate(results):
            print("%s %s %s %s %s %s %s" % (
                str(i).ljust(7),
                "".ljust(25) if result["series"]["firstAirDate"] is None else result["series"]["firstAirDate"].ljust(25),
                year.ljust(15),
                season.ljust(15),
                episode.ljust(11),
                result["series"]["name"].ljust(48),
                result["name"]
            ))

        print("")
        result_index = prompt_nuber(0, len(results) - 1)

        if result_index is None:
            continue

        media_id = int(results[result_index]["id"])

    if media_id is not None:
        create_asset(sha, "tv_episode", duration, file_name, height, media_id, size, size, width)

        if not os.path.exists(f"/Users/ncfritz/Temp/dionysus/ffprobe/final/tv_episodes/{media_id}"):
            os.mkdir(f"/Users/ncfritz/Temp/dionysus/ffprobe/final/tv_episodes/{media_id}")

        shutil.copy(
            file,
            f"/Users/ncfritz/Temp/dionysus/ffprobe/final/tv_episodes/{media_id}/metadata.json"
        )

        if file_name.endswith(".mkv"):
            shutil.copy(
                file,
                f"/Users/ncfritz/Temp/dionysus/ffprobe/final/tv_episodes/{media_id}/original_metadata.json"
            )

        shutil.move(file, "/Users/ncfritz/Temp/dionysus/ffprobe/tv_episodes_processed")

    """
    while True:
        choice = input(f"\nContinue (y/n) [y]: ").strip().lower()

        if choice.strip() in ['y', 'yes', '']:
            break
        elif choice in ['n', 'no']:
            sys.exit(0)
        else:
            print("Please enter 'yes/y' or 'no/n'.")
    """
