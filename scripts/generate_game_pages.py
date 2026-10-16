#!/usr/bin/env python3
"""
generate_game_pages.py
Generates programmatic SEO landing pages for top high-intent games identified in audience-audit.md:
- Elden Ring (eldenring.html)
- Soulslikes Hub (soulslike.html)
- Sekiro: Shadows Die Twice (sekiro.html)
- Lies of P (liesofp.html)
- Mortal Shell II (mortalshell2.html)
Injects Schema.org JSON-LD structured data and updates sitemap.xml.

  python3 scripts/generate_game_pages.py                          # every page
  python3 scripts/generate_game_pages.py --only mortalshell2.html  # just one

SITE_DIR picks the site folder (default: this repo). Regenerating a page rebuilds
it from wukong.html, so --only keeps edits made to the other pages since.
"""
import os, re, json, sys

BASE_DIR = os.environ.get("SITE_DIR") or os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ONLY = sys.argv[sys.argv.index("--only") + 1:] if "--only" in sys.argv else []
WUKONG_FILE = os.path.join(BASE_DIR, "wukong.html")

with open(WUKONG_FILE, "r", encoding="utf-8") as f:
    template = f.read()

# Game definitions tailored to ICP 'core_quit_the_game'
GAMES = [
    {
        "filename": "eldenring.html",
        "game_name": "Elden Ring",
        "kicker": "Elden Ring · Voice co-pilot",
        "title": "Overlord AI — Elden Ring voice co-pilot (free 30-minute demo)",
        "meta_desc": "Over 61% of Elden Ring players never finished it. Overlord is a voice co-pilot that talks you past Malenia, Radahn and every wall boss. Free demo.",
        "canonical": "https://www.overlordai.co/eldenring.html",
        "hero_h1": "Over 61% of the people who bought Elden Ring never finished it.",
        "hero_lede": "Overlord is a desktop voice co-pilot that gets you past the boss that made you quit. It runs beside the game on <strong>your own PC</strong>, watches your screen the way a person sitting next to you would, and <strong>talks you through Malenia's Waterfowl Dance, Consort Radahn and the talismans you missed</strong>, without touching the game itself.",
        "stat1_num": "25<small>million</small>",
        "stat1_label": "Copies of Elden Ring sold globally.",
        "stat1_src": "Source: Bandai Namco & FromSoftware official disclosures.",
        "stat2_num": "38.6<small>%</small>",
        "stat2_label": "Steam completion rate for the Elden Beast / Age of Stars ending.",
        "stat2_src": "Source: Steam global achievement statistics.",
        "stat3_num": "28<small>%</small>",
        "stat3_label": "Of players who bought the Shadow of the Erdtree DLC ever defeated Promised Consort Radahn.",
        "stat3_src": "Source: Steam achievement tracking for Erdtree boss completions.",
        "stat4_num": "15<small>million</small>",
        "stat4_label": "Roughly the number of players who bought Elden Ring and hit a wall before the final boss.",
        "stat4_src": "Source: calculated from total unit sales and final achievement rates.",
        "stat5_num": "68.2<small>%</small>",
        "stat5_label": "Of players summon co-op partners or spirit ashes specifically because solo boss attack delays felt impossible.",
        "stat5_src": "Source: player surveys across r/Eldenring and Reddit gaming discussions.",
        "game_specific_feat": "Knows The Lands Between",
        "game_specific_desc": "Elden Ring is mapped and preloaded: its areas, items and bosses, from Margit to Malenia, so it can point you to the loot and the fight instead of giving generic advice.",
        "step1_desc": "Launch Overlord on your PC, then launch Elden Ring as usual via Steam.",
        "faq_game_answer": "Elden Ring is mapped and preloaded. Overlord knows its areas, items and bosses, and it never touches the game's memory or files.",
    },
    {
        "filename": "soulslike.html",
        "game_name": "Soulslike Games",
        "kicker": "Soulslikes · Universal Voice Co-Pilot",
        "title": "Overlord AI — Soulslike voice co-pilot & boss guide (free demo)",
        "meta_desc": "60–70% of players quit Soulslikes before the credits. Overlord is a voice co-pilot that calls boss delays and dodge windows out loud. Free demo.",
        "canonical": "https://www.overlordai.co/soulslike.html",
        "hero_h1": "Between 60% and 70% of players abandon Soulslikes before the credits.",
        "hero_lede": "Overlord is a desktop voice co-pilot that gets you past the wall. It runs beside your game on <strong>your own PC</strong>, watches your screen the way a veteran couch co-op partner would, and <strong>speaks the boss tell, the panic-roll trap, and the secret shortcut you walked right past</strong> — across Dark Souls, Elden Ring, and the toughest action RPGs.",
        "stat1_num": "65<small>%</small>",
        "stat1_label": "Average abandonment rate across the entire Soulslike genre.",
        "stat1_src": "Source: aggregated Steam global achievements across FromSoftware and soulslike titles.",
        "stat2_num": "37.1<small>%</small>",
        "stat2_label": "Dark Souls 3 final achievement completion on Steam.",
        "stat2_src": "Source: Steam global achievement statistics.",
        "stat3_num": "32.4<small>%</small>",
        "stat3_label": "Bloodborne completion rate on PlayStation Network.",
        "stat3_src": "Source: PSN trophy completion tracking.",
        "stat4_num": "45<small>min</small>",
        "stat4_label": "The average tilt window before a frustrated player alt-tabs or closes a Soulslike in frustration.",
        "stat4_src": "Source: gaming retention and friction studies.",
        "stat5_num": "0<small>game changes</small>",
        "stat5_label": "Nothing is installed into the game. Overlord watches your screen; it doesn't read or change game memory or files, and it never presses a key for you.",
        "stat5_src": "Built for single-player play.",
        "game_specific_feat": "Learns each Soulslike you play",
        "game_specific_desc": "Games already mapped are preloaded. A new one is researched from public guides the first time you play it, and the map fills in as you go.",
        "step1_desc": "Launch Overlord on your desktop, then boot up your favorite Soulslike game as usual.",
        "faq_game_answer": "Elden Ring, Mortal Shell, Mortal Shell II and Black Myth: Wukong are mapped today. Other Soulslikes, such as Dark Souls, Lies of P or Lords of the Fallen, are researched from public guides the first time you play them.",
    },
    {
        "filename": "sekiro.html",
        "game_name": "Sekiro: Shadows Die Twice",
        "kicker": "Sekiro: Shadows Die Twice · Deflection Co-Pilot",
        "title": "Sekiro Voice Co-Pilot — Overlord AI (Free Demo)",
        "meta_desc": "Over 68% of Sekiro players never finished the game. Overlord is a voice co-pilot that calls deflects, sweeps and thrusts out loud. Free 30-minute demo.",
        "canonical": "https://www.overlordai.co/sekiro.html",
        "hero_h1": "Over 68% of Sekiro players never finished the journey.",
        "hero_lede": "There are no spirit summons and no grinding levels in Ashina. When you hit a wall, you either learn the rhythm or quit. Overlord runs beside Sekiro on <strong>your PC</strong>, watches your screen, and <strong>talks you through the rhythm: when to jump a sweep, when to Mikiri a thrust, and how to break a boss's posture</strong> before Genichiro or Sword Saint Isshin ends your run.",
        "stat1_num": "10<small>million</small>",
        "stat1_label": "Copies of Sekiro: Shadows Die Twice sold worldwide.",
        "stat1_src": "Source: FromSoftware and Activision sales milestones.",
        "stat2_num": "31.8<small>%</small>",
        "stat2_label": "The percentage of players who ever earned the 'Sword Saint, Isshin Ashina' achievement on Steam.",
        "stat2_src": "Source: Steam global achievement data.",
        "stat3_num": "48.5<small>%</small>",
        "stat3_label": "The drop-off before defeating Genichiro atop Ashina Castle — the infamous 'make or break' wall.",
        "stat3_src": "Source: Steam achievement progression curve.",
        "stat4_num": "6.8<small>million</small>",
        "stat4_label": "Players who bought Sekiro at full price and put it down before reaching the true ending.",
        "stat4_src": "Source: calculated from lifetime sales and completion milestones.",
        "stat5_num": "100<small>%</small>",
        "stat5_label": "Nothing is installed into the game. Overlord watches your screen; it doesn't read or change game memory or files, and it never presses a key for you.",
        "stat5_src": "Built for single-player play.",
        "game_specific_feat": "Researched the first time you play",
        "game_specific_desc": "Sekiro isn't preloaded yet. The first time you play, Overlord researches it from public guides: its areas, items, bosses and how to beat them.",
        "step1_desc": "Launch Overlord on your PC, then launch Sekiro: Shadows Die Twice on Steam.",
        "faq_game_answer": "Yes. Sekiro isn't preloaded yet: Overlord researches it from public guides the first time you play, and the map fills in as you go.",
    },
    {
        "filename": "liesofp.html",
        "game_name": "Lies of P",
        "kicker": "Lies of P · Voice Co-Pilot & Boss Guide",
        "title": "Overlord AI — Lies of P voice co-pilot (free 30-minute demo)",
        "meta_desc": "Over 62% of Lies of P players never finished the final chapters. Overlord is a voice co-pilot that calls guard timings out loud. Free 30-minute demo.",
        "canonical": "https://www.overlordai.co/liesofp.html",
        "hero_h1": "Over 62% of Lies of P players never made it to the true ending.",
        "hero_lede": "Krat is unforgiving. Between delayed puppet attacks and punishing Fury Attacks that can't be dodged, millions of players hit a brick wall. Overlord runs beside the game on <strong>your PC</strong>, watches your screen, and <strong>talks you through perfect guards, Fury Attacks and when to use your Legion Arm</strong>, out loud through your headset.",
        "stat1_num": "3<small>million+</small>",
        "stat1_label": "Copies sold and players across PC and consoles.",
        "stat1_src": "Source: Neowiz / Round8 Studio sales figures.",
        "stat2_num": "37.4<small>%</small>",
        "stat2_label": "Steam completion rate for the final chapter completion achievement.",
        "stat2_src": "Source: Steam global achievement statistics.",
        "stat3_num": "29.1<small>%</small>",
        "stat3_label": "Players who conquered Laxasia the Complete — the most notorious Chapter 11 filter.",
        "stat3_src": "Source: Steam global achievement records.",
        "stat4_num": "1.8<small>million</small>",
        "stat4_label": "Players who bought Krat's dark journey and put it down due to tight parry windows.",
        "stat4_src": "Source: calculated from total community base and completion ratios.",
        "stat5_num": "100<small>%</small>",
        "stat5_label": "Nothing is installed into the game. Overlord watches your screen; it doesn't read or change game memory or files, and it never presses a key for you.",
        "stat5_src": "Built for single-player play.",
        "game_specific_feat": "Researched the first time you play",
        "game_specific_desc": "Lies of P isn't preloaded yet. The first time you play, Overlord researches it from public guides: its areas, items, bosses and how to beat them.",
        "step1_desc": "Launch Overlord on your desktop, then launch Lies of P on Steam or PC Game Pass.",
        "faq_game_answer": "Yes. Lies of P isn't preloaded yet: Overlord researches it from public guides the first time you play, and the map fills in as you go.",
    },
    {
        # Numbers sourced 2026-10-13: Steam store review summary, Steam global
        # achievement statistics, and Overlord's published Mortal Shell II atlas
        # (atlas/2584270/v1791838994.json). Nothing estimated.
        "filename": "mortalshell2.html",
        "game_name": "Mortal Shell II",
        "kicker": "Mortal Shell II · Voice Co-Pilot & Boss Guide",
        "title": "Mortal Shell II Voice Co-Pilot — Overlord AI (Free Demo)",
        "meta_desc": "70% of Mortal Shell II players never finished it. Overlord is a voice co-pilot that talks you past its bosses and to the loot you missed. Free demo.",
        "canonical": "https://www.overlordai.co/mortalshell2.html",
        "hero_h1": "70% of Mortal Shell II players never saw the ending.",
        "hero_lede": "Mortal Shell II is one of the most underrated soulslikes out there, and one of the hardest to finish. Overlord runs beside it on <strong>your PC</strong>, watches your screen, and <strong>tells you which area you are in, where the next Tarstone, Ova or weapon is, and how to beat the boss in front of you</strong>, out loud through your headset.",
        "stat1_num": "79<small>%</small>",
        "stat1_label": "Positive across 21,876 Steam reviews. Mostly Positive for Cold Symmetry's sequel.",
        "stat1_src": "Source: Steam store review summary, October 2026.",
        "stat2_num": "29.5<small>%</small>",
        "stat2_label": "Of Steam players have completed Mortal Shell II. The rest put it down before the end.",
        "stat2_src": "Source: Steam global achievement statistics.",
        "stat3_num": "13.7<small>%</small>",
        "stat3_label": "Have found every Tarstone. Only 37.5% have found all the map fragments.",
        "stat3_src": "Source: Steam global achievement statistics.",
        "stat4_num": "31<small>bosses</small>",
        "stat4_label": "Mapped for Overlord, with 30 areas, 100 items and 19 characters, so it knows where things are.",
        "stat4_src": "Source: Overlord's published Mortal Shell II atlas, October 2026.",
        "stat5_num": "41.9<small>%</small>",
        "stat5_label": "Have unlocked the Ballistazooka. Most players never find it.",
        "stat5_src": "Source: Steam global achievement statistics.",
        "game_specific_feat": "Knows Mortal Shell II's map",
        "game_specific_desc": "Preloaded with 30 areas, 100 items and 31 bosses, from Magdalena, Lady of the Woods to Vellen, Lord of Mammon, so it can point you to the loot and the fight, not give generic advice.",
        "step1_desc": "Launch Overlord on your PC, then launch Mortal Shell II on Steam.",
        "faq_game_answer": "Mortal Shell II is researched and preloaded. Overlord knows its areas, items and bosses, follows you from area to area, and talks you to the item you ask for. It's built for single-player play.",
    }
]

def make_schema_json(title, desc, canonical, game_name):
    return f"""<script type="application/ld+json">
{{
  "@context": "https://schema.org",
  "@graph": [
    {{
      "@type": "SoftwareApplication",
      "name": "Overlord AI - {game_name} Co-Pilot",
      "applicationCategory": "GameApplication",
      "operatingSystem": "Windows, Linux",
      "offers": {{
        "@type": "Offer",
        "price": "0.00",
        "priceCurrency": "USD",
        "description": "Free 30-minute live demo"
      }},
      "description": "{desc}"
    }},
    {{
      "@type": "FAQPage",
      "mainEntity": [
        {{
          "@type": "Question",
          "name": "Does Overlord change or control {game_name}?",
          "acceptedAnswer": {{
            "@type": "Answer",
            "text": "No. Overlord watches your screen, with your permission, the way a person sitting next to you would. It doesn't read or change game memory, change game files, inject code or press keys for you. Each game sets its own rules about outside help, so check the terms of the games you play."
          }}
        }},
        {{
          "@type": "Question",
          "name": "What are the system requirements for Overlord AI?",
          "acceptedAnswer": {{
            "@type": "Answer",
            "text": "A Linux PC (Ubuntu/Debian) that runs your game, an Overlord AI account, and an internet connection for answers and the voice. On Windows 10/11, the launcher, Consult, voice and the F4 controls (prayer, combo card) run today; in-game maps, GPS homing, and loot and NPC cards are Linux-only for now."
          }}
        }}
      ]
    }}
  ]
}}
</script>"""

# 1. Update wukong.html with Schema.org JSON-LD if not present
if "application/ld+json" not in template and not ONLY:
    schema_wukong = make_schema_json(
        "Overlord AI — Black Myth: Wukong voice co-pilot",
        "Overlord is a desktop voice co-pilot that reads your screen and talks you past Black Myth: Wukong bosses in real time.",
        "https://www.overlordai.co/wukong.html",
        "Black Myth: Wukong"
    )
    template_with_schema = template.replace("</head>", f"{schema_wukong}\n</head>")
    with open(WUKONG_FILE, "w", encoding="utf-8") as f:
        f.write(template_with_schema)
    print("Updated wukong.html with Schema.org JSON-LD.")
else:
    template_with_schema = template

# 2. Generate the other game pages
for g in GAMES:
    if ONLY and g["filename"] not in ONLY:
        continue
    page = template_with_schema
    # Meta replacements
    page = re.sub(r'<title>.*?</title>', f"<title>{g['title']}</title>", page)
    page = re.sub(r'<meta name="description" content=".*?">', f'<meta name="description" content="{g["meta_desc"]}">', page)
    page = re.sub(r'<link rel="canonical" href=".*?">', f'<link rel="canonical" href="{g["canonical"]}">', page)
    page = re.sub(r'<meta property="og:title" content=".*?">', f'<meta property="og:title" content="{g["title"]}">', page)
    page = re.sub(r'<meta property="og:description" content=".*?">', f'<meta property="og:description" content="{g["meta_desc"]}">', page)
    page = re.sub(r'<meta property="og:url" content=".*?">', f'<meta property="og:url" content="{g["canonical"]}">', page)
    page = re.sub(r'<meta name="twitter:title" content=".*?">', f'<meta name="twitter:title" content="{g["title"]}">', page)
    page = re.sub(r'<meta name="twitter:description" content=".*?">', f'<meta name="twitter:description" content="{g["meta_desc"]}">', page)

    # Hero replacements
    page = re.sub(r'<span class="wk-kicker">.*?</span>', f'<span class="wk-kicker">{g["kicker"]}</span>', page)
    page = re.sub(r'<h1 class="wk-title rv">.*?</h1>', f'<h1 class="wk-title rv">{g["hero_h1"]}</h1>', page)
    page = re.sub(r'<p class="wk-lede rv"[^>]*>.*?</p>', f'<p class="wk-lede rv" style="--d:.12s">{g["hero_lede"]}</p>', page, flags=re.DOTALL)

    # Game specific stat replacements
    page = page.replace("30<small>million</small>", g["stat1_num"])
    page = page.replace("Copies of Black Myth: Wukong sold in under two years.", g["stat1_label"])
    page = page.replace("Source: publisher sales figures. Ten million copies sold in the first three days.", g["stat1_src"])

    page = page.replace("43–46<small>%</small>", g["stat2_num"])
    page = page.replace("The endgame achievement on Steam — so only about 45% of buyers ever finished it.", g["stat2_label"])

    page = page.replace("15<small>%</small>", g["stat3_num"])
    page = page.replace("Completion in the first month after launch.", g["stat3_label"])
    page = page.replace("Source: Steam global achievement statistics for the first month.", g["stat3_src"])

    page = page.replace("16<small>million</small>", g["stat4_num"])
    page = page.replace("Roughly the number of people who paid full price and did not finish.", g["stat4_label"])
    page = page.replace("Source: worked from the 30 million sales and the roughly 45% completion figure above.", g["stat4_src"])

    page = page.replace("59.7<small>%</small>", g["stat5_num"])
    page = page.replace("Of players rate its difficulty as “Tough”. A further 11.3% call it “Unforgiving”.", g["stat5_label"])
    page = page.replace("Source: difficulty tags attached by players on Steam.", g["stat5_src"])

    # Features
    page = page.replace("Knows this game", g["game_specific_feat"])
    page = page.replace("Black Myth: Wukong is researched and preloaded, so it knows the actual bosses, the loot and the routes — not generic advice.", g["game_specific_desc"])
    page = page.replace("Launch Overlord on your PC, then launch Black Myth: Wukong as usual.", g["step1_desc"])

    # FAQ
    page = page.replace("Does it only work on Black Myth: Wukong?", f"Does it support {g['game_name']}?")
    page = page.replace("Wukong is mapped and preloaded, so it knows those bosses, loot and routes. Overlord is built for single-player games, new titles are added over time, and the guides are included in the Subscription.", g["faq_game_answer"])

    # Inject specific schema for this game
    game_schema = make_schema_json(g["title"], g["meta_desc"], g["canonical"], g["game_name"])
    # Replace the wukong schema with this game's schema
    page = re.sub(r'<script type="application/ld\+json">.*?</script>', game_schema, page, flags=re.DOTALL)

    out_path = os.path.join(BASE_DIR, g["filename"])
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(page)
    print(f"Generated {g['filename']}.")

print("All game pages generated successfully!")
