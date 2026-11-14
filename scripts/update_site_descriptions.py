"""Enrich data/sites.json and library_index.json with student-friendly descriptions,
why NASA cares, and memorable fun facts for all 14 lunar sites.
"""

import json
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
SITES_PATH = BASE_DIR / "data" / "sites.json"
LIB_PROC = BASE_DIR / "data" / "processed" / "library_index.json"
LIB_WEB = BASE_DIR / "web" / "public" / "data" / "library_index.json"

SITE_STORIES = {
    "shackleton_connecting_ridge": {
        "simple_description": "A narrow mountain ridge balancing right on the rim of Shackleton Crater, just 10 kilometers from the Moon's South Pole. Because of its height, it acts like a natural lighthouse catching sunlight almost non-stop.",
        "why_nasa_cares": "Prime candidate for NASA's Artemis III crewed landing. Astronauts can set up solar panels on the illuminated ridge while robot rovers venture down into the dark crater floor to search for ancient frozen water ice.",
        "key_fun_fact": "The crater bowl right below this ridge is permanently frozen in shadow at -410°F (-246°C) and has not seen sunlight in over two billion years!"
    },
    "shackleton_peak": {
        "simple_description": "A high towering peak located mere kilometers from the exact lunar South Pole. It is one of the highest geological points on the Shackleton crater rim, offering a panoramic view across the polar highlands.",
        "why_nasa_cares": "Its exceptional height grants extended periods of solar energy. Rovers landing here can maintain uninterrupted line-of-sight communications with orbiting relay satellites.",
        "key_fun_fact": "At this peak, you are standing closer to the Moon's true rotational South Pole (only 0.22° away) than any human has ever been."
    },
    "de_gerlache_rim_1": {
        "simple_description": "The elevated crest of de Gerlache crater, named after Belgian polar explorer Adrien de Gerlache. It forms a natural defensive wall against the deep lunar cold.",
        "why_nasa_cares": "Because it points toward Earth, this site offers superior direct-to-Earth radio communications, eliminating the risk of sudden communication blackouts during human spacewalks.",
        "key_fun_fact": "The Earth never sets below the horizon from this ridge—it hovers as a brilliant blue marble perpetually circling low in the sky."
    },
    "de_gerlache_rim_2": {
        "simple_description": "The northern edge of de Gerlache crater. It features gentle, rolling slopes that make driving a lunar rover far safer than on jagged mountain peaks.",
        "why_nasa_cares": "Offers wide flat landing zones meeting NASA's strict safety rule that landing spacecraft tilt no more than 15 degrees during touchdown.",
        "key_fun_fact": "The soil here consists of fine powdery pulverized lunar rock (regolith) created by billions of years of meteorite impacts."
    },
    "connecting_ridge_ext": {
        "simple_description": "A rugged geological bridge of highlands connecting the massive Shackleton and de Gerlache crater systems across the Moon's bottom hemisphere.",
        "why_nasa_cares": "Serves as an exploration highway. Astronauts landing here can travel north or south to reach multiple scientific targets within short rover drives.",
        "key_fun_fact": "Walking here in the Moon's one-sixth gravity, an astronaut weighing 180 lbs on Earth feels like they weigh only 30 lbs!"
    },
    "malapert_mountain": {
        "simple_description": "A gigantic lunar mountain massif rising an astonishing 5,000 meters (16,400 feet) above the surrounding crater plains—taller than Mount Rainier on Earth!",
        "why_nasa_cares": "The 'Mount Everest' of the lunar South Pole. Its immense elevation grants the longest unbroken view of Earth (over 63% continuous geometric visibility) for mission control communications.",
        "key_fun_fact": "From the summit of Malapert Massif, you can look down across thousands of square miles of ancient lunar terrain in every direction."
    },
    "haworth_rim": {
        "simple_description": "The rim of Haworth Crater, bordering one of the deepest and coldest Permanently Shadowed Regions (PSRs) on the entire Moon.",
        "why_nasa_cares": "Scientists believe the floor of Haworth contains billions of tons of ancient water ice, which future astronauts can purify for drinking water and split into hydrogen and oxygen rocket fuel.",
        "key_fun_fact": "Temperatures inside the shadowed crater drop to -415°F (-248°C), making it colder than the surface of Pluto!"
    },
    "nobile_rim_1": {
        "simple_description": "The mountain plateau on the rim of Nobile crater. This is the exact primary landing site chosen for NASA's VIPER ice-hunting rover mission.",
        "why_nasa_cares": "Selected by NASA scientists because it provides safe rover driving routes between illuminated solar ridges and shadowed craters with suspected subsurface water ice.",
        "key_fun_fact": "The crater is named after Umberto Nobile, an Italian aeronautical engineer who explored Earth's Arctic North Pole by airship in 1926."
    },
    "amundsen_rim": {
        "simple_description": "The raised eastern flank of the gargantuan 105-kilometer-wide Amundsen impact crater, named after Roald Amundsen, the first person to reach Earth's South Pole.",
        "why_nasa_cares": "The crater is so large that its walls formed terraced steps. It exposes deep lunar crust rocks dug up from miles underneath the surface by a prehistoric asteroid collision.",
        "key_fun_fact": "If you stood on one side of Amundsen crater, the opposite rim would be over 65 miles away over the curved lunar horizon."
    },
    "faustini_rim_a": {
        "simple_description": "An elevated ridge wedged between two deep polar craters (Faustini and Shoemaker). It acts like a high balcony overlooking shadowed crater bowls.",
        "why_nasa_cares": "Offers a strategic vantage point for establishing long-duration scientific sensor stations powered by low-angle horizontal solar arrays.",
        "key_fun_fact": "The adjacent crater is named in honor of Eugene Shoemaker, the famous planetary scientist whose ashes were carried to the Moon aboard NASA's Lunar Prospector in 1999."
    },
    "apollo_11": {
        "simple_description": "Statio Tranquillitatis (Tranquility Base) in Mare Tranquillitatis. The historic equatorial spot where Neil Armstrong and Buzz Aldrin first set human foot on the Moon on July 20, 1969.",
        "why_nasa_cares": "The foundational benchmark of human lunar exploration. It proves how spacecraft handle flat basaltic volcanic plains and serves as our scientific calibration baseline.",
        "key_fun_fact": "The descent stage of the Eagle lunar module, Neil Armstrong's boot prints, and the Apollo 11 laser reflector are still sitting preserved at this exact site today!"
    },
    "apollo_12": {
        "simple_description": "Oceanus Procellarum (Ocean of Storms). The second human landing, where Pete Conrad and Alan Bean executed a pinpoint landing right next to the robotic Surveyor III spacecraft.",
        "why_nasa_cares": "Demonstrated that humans could land with meter-scale precision near pre-existing hardware. The astronauts brought back parts of Surveyor III to see how machines survive the harsh lunar environment.",
        "key_fun_fact": "Pete Conrad's first words upon stepping onto the lunar dust here were: 'Whoopee! Man, that may have been a small one for Neil, but that's a long one for me!'"
    },
    "apollo_17": {
        "simple_description": "Taurus-Littrow Valley. The final Apollo human mission in December 1972, where astronaut-geologist Harrison Schmitt and Gene Cernan spent three days exploring a deep lunar valley.",
        "why_nasa_cares": "The most geologically diverse Apollo site. The crew discovered orange volcanic glass beads that proved the Moon experienced explosive volcanic fire fountains billions of years ago.",
        "key_fun_fact": "Gene Cernan drove the Lunar Roving Vehicle to a top speed of 11.2 mph (18 km/h) across this valley—setting the all-time human lunar speed record!"
    },
    "change_4": {
        "simple_description": "Von Kármán crater inside the South Pole-Aitken Basin. On January 3, 2019, the Chinese Chang'e 4 mission made history by achieving the world's very first soft landing on the far side of the Moon.",
        "why_nasa_cares": "Because the far side permanently faces away from Earth, it is 100% shielded from Earth's noisy radio broadcasts. It is the premier site in the solar system for radio astronomy to listen to the earliest stars in the universe.",
        "key_fun_fact": "Because Earth is permanently blocked by the bulk of the Moon (0.0% line of sight), Chang'e 4 cannot talk to Earth directly and must bounce all signals through a relay satellite named Queqiao ('Magpie Bridge')!"
    }
}

def update_sites():
    with open(SITES_PATH, "r", encoding="utf-8") as f:
        sites = json.load(f)

    for site in sites:
        s_id = site["id"]
        if s_id in SITE_STORIES:
            story = SITE_STORIES[s_id]
            site["simple_description"] = story["simple_description"]
            site["why_nasa_cares"] = story["why_nasa_cares"]
            site["key_fun_fact"] = story["key_fun_fact"]

    with open(SITES_PATH, "w", encoding="utf-8") as f:
        json.dump(sites, f, indent=2)
    print("Updated data/sites.json!")

    # Also sync into library_index.json
    for path in [LIB_PROC, LIB_WEB]:
        if path.exists():
            with open(path, "r", encoding="utf-8") as f:
                lib = json.load(f)
            for s_entry in lib.get("sites", []):
                s_id = s_entry["id"]
                if s_id in SITE_STORIES:
                    s_entry["simple_description"] = SITE_STORIES[s_id]["simple_description"]
                    s_entry["why_nasa_cares"] = SITE_STORIES[s_id]["why_nasa_cares"]
                    s_entry["key_fun_fact"] = SITE_STORIES[s_id]["key_fun_fact"]
            with open(path, "w", encoding="utf-8") as f:
                json.dump(lib, f, indent=2)
            print(f"Updated {path}!")

if __name__ == "__main__":
    update_sites()
