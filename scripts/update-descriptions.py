import json, hashlib, urllib.request

password = "QaYFSrefhThp7V9eFBa!"
token = hashlib.sha256(password.encode()).hexdigest()

req = urllib.request.Request("https://gregsmarketplace.com/api/inventory",
    headers={"x-admin-token": token})
with urllib.request.urlopen(req) as r:
    data = json.loads(r.read())

updates = {
    "trek-madone-ssl-7symbols": {
        "title": '2006 Trek Madone SSL "7-Symbols" Livestrong Tribute - 58cm - Never Ridden',
        "condition": "Brand New - Never Ridden",
        "shippingType": "bicycle",
        "description": (
            'A true collector-grade example of the 2006 Madone SSL in the ultra-rare "7-Symbols" Livestrong tribute scheme '
            "-- mirroring the exact colorway ridden onto the Champs-Elysees for Armstrong's seventh and final Tour victory. "
            "This bike was built as a time capsule and has never been ridden.\n\n"
            "The build is exceptionally cohesive, featuring a full Shimano Dura-Ace 7800 groupset paired with matching "
            "Bontrager Race XXX Lite components throughout -- including the highly uncommon gold cockpit, crankset, and wheelset. "
            "This is not a replica-style build or a mix of parts. It was assembled deliberately to reflect the aesthetic and significance of the period.\n\n"
            "Condition is as close to new as you will find for this era. No wear, no storage damage, no crash history. "
            "For collectors of Livestrong-era Trek bikes, this is one of the more complete and difficult configurations to recreate today.\n\n"
            "Includes 2x water bottles and 2x Nike watches."
        ),
        "details": {
            "Year": "2006",
            "Model": "Trek Madone SSL Project One",
            "Paint": '"7-Symbols" Livestrong Tribute (ultra-rare)',
            "Frame": "Trek OCLV Carbon",
            "Size": "58cm",
            "Condition": "10/10 - Brand new, never ridden",
            "Shifters": "Shimano Dura-Ace 7800",
            "Front Derailleur": "Shimano Dura-Ace 7800",
            "Rear Derailleur": "Shimano Dura-Ace 7800",
            "Crankset": "Bontrager Race XXX Lite (gold)",
            "Cassette": "Shimano Dura-Ace 7800",
            "Chain": "Shimano Dura-Ace",
            "Brakes": "Shimano Dura-Ace 7800",
            "Handlebars": "Bontrager Race XXX Lite carbon (gold)",
            "Stem": "Bontrager Race XXX Lite carbon (gold)",
            "Seatpost": "Bontrager Race XXX Lite carbon (gold)",
            "Saddle": "Bontrager Race XXX Lite (gold)",
            "Wheelset": "Bontrager Race XXX Lite (gold)",
            "Tires": "Bontrager Race X Lite Pro 700x23",
            "Bottle Cages": "Bontrager",
            "Included": "2x water bottles, 2x Nike watches",
        }
    },
    "trek-madone-59-usps": {
        "title": "2003 Trek Madone 5.9 Tour Commemorative #236/500 - 58cm - SRAM Red Yellow",
        "condition": "9/10",
        "shippingType": "bicycle",
        "description": (
            "Numbered #236 of 500, this 2003 Madone 5.9 Tour Commemorative represents one of the more interesting crossover builds from the Livestrong era.\n\n"
            "The frame has been professionally protected with clear vinyl film and presents extremely well, with only minimal signs of prior use. "
            "The build is centered around the rare SRAM Red Limited Tour Edition groupset in yellow -- including matching shifters, brakes, front derailleur, "
            "and crankset -- a combination that is increasingly difficult to find intact.\n\n"
            "Complemented by a full Bontrager Race XXX Lite carbon cockpit, seatpost, saddle, and wheelset, this is a clean, period-consistent build. "
            "A thoughtful collector configuration rather than a stock setup."
        ),
        "details": {
            "Year": "2003",
            "Model": "Trek Madone 5.9",
            "Edition": "Tour de France Commemorative #236 of 500",
            "Frame": "Trek OCLV Carbon",
            "Size": "58cm",
            "Condition": "9/10 - Clear protective film; minimal wear",
            "Shifters": "SRAM Red Limited Tour Edition (yellow)",
            "Front Derailleur": "SRAM Red Limited Tour Edition (yellow)",
            "Rear Derailleur": "SRAM Red Limited Tour Edition (yellow)",
            "Crankset": "SRAM Red Limited Tour Edition (yellow)",
            "Cassette": "SRAM Red",
            "Chain": "SRAM",
            "Brakes": "SRAM Red Limited Tour Edition (yellow)",
            "Handlebars": "Bontrager Race XXX Lite carbon",
            "Stem": "Bontrager Race XXX Lite carbon",
            "Seatpost": "Bontrager Race XXX Lite carbon",
            "Saddle": "Bontrager Race XXX Lite full carbon",
            "Wheelset": "Bontrager Race XXX Lite carbon",
            "Tires": "Continental Gatorskin tubular 700x25",
            "Bottle Cages": "Bontrager Race X Lite carbon",
            "Pedals": "Bontrager Race XXX Lite carbon",
        }
    },
    "trek-madone-69-livestrong": {
        "title": "2010 Trek Madone 6.9 H1 Livestrong #1274 - 56cm - SRAM Force AXS 1x12",
        "condition": "9.5/10",
        "shippingType": "bicycle",
        "description": (
            'This is a Livestrong Madone 6.9 H1 in the "1274" paint scheme -- a reference to the number of days between '
            "Armstrong's retirement and his return to the peloton -- and the one bike in the group I've kept set up to actually ride.\n\n"
            "I updated it with a SRAM Force AXS 1x12 drivetrain (44T / 12-32) to simplify the setup and make it far more usable "
            "day-to-day without compromising the character of the frame. It's paired with HED Jet RC6 wheels, which suit the bike "
            "well and keep it feeling quick and responsive.\n\n"
            "The frame remains in excellent condition with no crash history and only light use (~300 miles/year). This was never meant "
            "to be a static display piece -- the goal was to take a meaningful frame and bring it forward just enough to enjoy regularly. "
            "It's a rare combination of something collectible that still rides like a modern bike.\n\n"
            "Includes 2x large chainrings and 2x chains."
        ),
        "details": {
            "Year": "2010",
            "Model": "Trek Madone 6.9 H1",
            "Edition": "Livestrong #1274",
            "Frame": "Trek OCLV Carbon (H1 race geometry)",
            "Size": "56cm",
            "Condition": "9.5/10 - Light use (~300 mi/yr); no crash history",
            "Shifters": "SRAM Force AXS (wireless)",
            "Rear Derailleur": "SRAM Force AXS",
            "Crankset": "SRAM Force AXS 1x (44T)",
            "Cassette": "12-32",
            "Chain": "SRAM AXS",
            "Brakes": "SRAM Force hydraulic",
            "Handlebars": "Vision Metron 4D",
            "Stem": "Bontrager XXX",
            "Saddle": "Selle Italia Tour de France Carbon Rail (Limited Edition)",
            "Wheelset": "HED Jet RC6 (black rim)",
            "Tires": "Continental Graphene tan sidewall 700x25",
            "Bottle Cages": "Bontrager XXX",
            "Included": "2x large chainrings, 2x chains",
        }
    },
    "colnago-ct2-titanium": {
        "title": "2004 Colnago CT2 HP - 56cm - Campagnolo Chorus - Titanium/Carbon",
        "condition": "Excellent Vintage",
        "shippingType": "bicycle",
        "description": (
            "A classic Colnago CT2 HP in 56cm -- a late-era lugged construction combining a titanium main triangle with carbon HP "
            "chain and seat stays. Light, responsive, and increasingly appreciated for its ride quality and craftsmanship.\n\n"
            "Built with a full Campagnolo Chorus 10-speed gruppo and period-correct components. The frame has been well cared for "
            "and remains in excellent condition, with only minor cosmetic imperfections typical of age. No structural issues, no crashes, no surprises.\n\n"
            "Includes 2x cassettes (Mavic, Shimano/SRAM freehub compatible) and 1x Colnago Chorus cassette."
        ),
        "details": {
            "Year": "2004",
            "Model": "Colnago CT2 HP",
            "Frame": "Titanium main triangle / Carbon HP stays",
            "Size": "56cm",
            "Condition": "Excellent vintage - minor cosmetic chips; no structural issues",
            "Shifters": "Campagnolo Chorus 10s",
            "Front Derailleur": "Campagnolo Chorus",
            "Rear Derailleur": "Campagnolo Chorus",
            "Crankset": "Campagnolo Chorus",
            "Cassette": "12-25",
            "Chain": "Campagnolo C10",
            "Brakes": "Campagnolo Chorus",
            "Handlebars": "FSA Plasma 400mm integrated",
            "Stem": "Integrated",
            "Seatpost": "Campagnolo Record",
            "Wheelset": "HED Stinger 4 tubular",
            "Tires": "Continental Grand Prix tubular 700x25",
            "Included": "2x Mavic cassettes (Shimano/SRAM compatible), 1x Colnago Chorus cassette",
        }
    },
    "orbea-ordu-tt": {
        "title": "2008 Orbea Ordu TT - 54cm - SRAM Red Limited Tour Edition - FLO 60/90",
        "condition": "Like New (~10 races)",
        "shippingType": "bicycle",
        "description": (
            "This Orbea Ordu started as a very clean, like-new frame and was built specifically around the SRAM Red Limited Tour "
            "Edition TT groupset -- which is increasingly hard to find, especially with the carbon TT900 shifters and carbon brake levers intact.\n\n"
            "The drivetrain runs 2x10 (53/39 + 10-23) with a Hawk Racing ceramic bottom bracket for smooth, efficient power transfer. "
            "Finished with Profile Design Volna carbon TT bars, a FLO 60/90 wheelset, and Vittoria Graphene tan-wall tires on latex tubes. "
            "A complete, dialed TT setup that would be very difficult to recreate today.\n\n"
            "Note: The rear derailleur is standard SRAM Red (not Limited Tour Edition) -- the one yellow RD went to the Trek Madone 5.9."
        ),
        "details": {
            "Year": "2008",
            "Model": "Orbea Ordu TT",
            "Frame": "Carbon",
            "Size": "54cm",
            "Condition": "Like New - ~10 races",
            "Shifters": "SRAM Red Limited Tour Edition TT900 carbon (yellow) + carbon brake levers",
            "Front Derailleur": "SRAM Red Limited Tour Edition (yellow)",
            "Rear Derailleur": "SRAM Red 10s",
            "Crankset": "SRAM Red 53/39 Limited Tour Edition (yellow)",
            "Cassette": "SRAM Red 10-23",
            "Chain": "SRAM PC1090",
            "Brakes": "SRAM Rival",
            "Bottom Bracket": "Hawk Racing ceramic",
            "Handlebars": "Profile Design Volna carbon TT",
            "Stem": "Profile Design",
            "Saddle": "ISM Adamo TT",
            "Wheelset": "FLO 60 (front) / FLO 90 (rear)",
            "Tires": "Vittoria Graphene tan sidewall 700x25 (latex tubes)",
        }
    }
}

for item in data["items"]:
    if item["id"] in updates:
        u = updates[item["id"]]
        item["title"] = u["title"]
        item["condition"] = u["condition"]
        item["description"] = u["description"]
        item["shippingType"] = u["shippingType"]
        item["details"] = u["details"]
        print(f"Updated: {item['id']}")

body = json.dumps(data).encode()
req = urllib.request.Request("https://gregsmarketplace.com/api/inventory",
    data=body,
    headers={"x-admin-token": token, "Content-Type": "application/json"},
    method="POST")
with urllib.request.urlopen(req) as r:
    result = json.loads(r.read())
    print(f"Save result: {result}")
