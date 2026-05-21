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


def search_by_title(title, year=None):
    query_parts = []

    query_parts.append('title: {{_ilike: "%{}%"}}'.format(title))

    if year is not None:
        query_parts.append('releaseDate: {{_ilike: "%{}%"}}'.format(year))

    where_clause = 'where: {{_and: {{{}}}}}'.format(','.join(query_parts)) if len(query_parts) > 1 else 'where: {{{}}}'.format(query_parts[0])

    query = """
      query q {{
        dionysus_movies({}, , order_by: {{title: desc}}) {{
          title
          releaseDate
          imdbId
          id
          runtime
        }}
      }}
    """.format(where_clause)

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


files = Path("/Users/ncfritz/Temp/dionysus/ffprobe/movies").iterdir()
regex = re.compile(r"(.+) \((\d+)\).json", flags=re.MULTILINE | re.UNICODE)

for file in files:
    title_parts = regex.match(file.name)

    if title_parts is None:
        print("{} did not match title regex - skipping".format(file))
        continue

    title = title_parts.group(1)
    year = title_parts.group(2)

    search_title = input(f"\n{title}: ").strip().lower()

    if not os.path.exists(f"/Users/ncfritz/Temp/dionysus/sha/movies/{title} ({year}).sha"):
        print(f"SHA for {title} not found - skipping")
        continue
    else:
        with open(f"/Users/ncfritz/Temp/dionysus/sha/movies/{title} ({year}).sha", "r") as s:
            sha = s.read().strip()

    raw_results = search_by_title(search_title)["data"]["dionysus_movies"]
    results = [r for r in raw_results if r["imdbId"] is not None]

    if len(results) == 0:
        print("No results found for {} ({})".format(title, year))
        continue

    release_date = datetime.datetime.fromisoformat(results[0]["releaseDate"]) if results[0]["releaseDate"] is not None else None
    exact_match = False

    with open(file, "r") as f:
        metadata = json.load(f)

        width = metadata["streams"][0]["width"]
        height = metadata["streams"][0]["height"]
        size = metadata["format"]["size"]
        duration = int(float(metadata["format"]["duration"]) * 1000)
        duration_min = int(duration / 1000 / 60)
        file_name = metadata["format"]["filename"]

    media_id = None

    if len(results) == 1 and results[0]["title"] == title and release_date.year == int(year):
        print("Exact match found for {} ({})".format(title, year))
        media_id = int(results[0]["id"])
        exact_match = True
    else:
        print("%s (%s)" % (title, year))
        print("===============================================================================================================================================")
        print("Result  Release Date               IMDB ID        ID             Runtime   Duration  Title")
        print("-----------------------------------------------------------------------------------------------------------------------------------------------")

        for i, result in enumerate(results):
            if result["imdbId"] is None:
                continue

            print("%s %s %s %s %s %s %s" % (
                str(i).ljust(7),
                "".ljust(25) if result["releaseDate"] is None else result["releaseDate"].ljust(25),
                "".ljust(15) if result["imdbId"] is None else result["imdbId"].ljust(15),
                str(int(result["id"])).ljust(15),
                "".ljust(10) if result["runtime"] is None else str(int(result["runtime"])).ljust(10),
                str(duration_min).ljust(10),
                result["title"]
            ))

        print("")
        result_index = prompt_nuber(0, len(results) - 1)

        if result_index is None:
            continue

        media_id = int(results[result_index]["id"])

    if media_id is not None:
        create_asset(sha, "movie", duration, file_name, height, media_id, size, size, width)

        if not os.path.exists(f"/Users/ncfritz/Temp/dionysus/ffprobe/final/movies/{media_id}"):
            os.mkdir(f"/Users/ncfritz/Temp/dionysus/ffprobe/final/movies/{media_id}")

        shutil.copy(
            file,
            f"/Users/ncfritz/Temp/dionysus/ffprobe/final/movies/{media_id}/metadata.json"
        )

        if file_name.endswith(".mkv"):
            shutil.copy(
                file,
                f"/Users/ncfritz/Temp/dionysus/ffprobe/final/movies/{media_id}/original_metadata.json"
            )

        shutil.move(file, "/Users/ncfritz/Temp/dionysus/ffprobe/movies_processed")

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
