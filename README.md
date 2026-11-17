# Solmar Heat

Open-world crime 2D top-down untuk bounty make.fun **gta6-01 "Make GTA 6"** — IP 100% orisinal, tanpa aset, nama, karakter, atau musik dari Rockstar / GTA.

Kota pesisir Solmar sedang panas-panasnya. Kamu **Rico**, sopir pendatang baru yang bekerja untuk fixer **Mama Luz**. Curi mobil, antar paket, kabur dari polisi, dan rebut takhta kota lewat 6 misi berantai di 5 distrik: **Marina Bay** (pelabuhan), **Old Town** (pasar/jalan sempit), **Downtown** (gedung tinggi), **Palm Heights** (perumahan bukit), dan **Industrial Docks** (gudang/kontainer).

## Cara main

Buka `game/index.html` lewat server statis (mis. `node serve.ts` lalu http://localhost:8080), klik **MULAI**.

| Kontrol | Aksi |
| --- | --- |
| WASD / panah | Jalan kaki & nyetir |
| E | Masuk / keluar mobil — E di dekat mobil untuk mencuri (sopir keluar) |
| F | Pukul (tinju) |
| G / klik mouse | Tembak pistol (bila punya pistol + amunisi) |
| P / Esc | Pause |

## Fitur

- **Kota terbuka**: jalan + trotoar + bangunan dengan collision, 5 distrik dengan palet dan suasana berbeda.
- **Mobil**: sedan, taksi, pickup, sport, van — beda kecepatan, akselerasi, dan handling.
- **Traffic**: mobil AI mengikuti jalan dan berhenti di persimpangan; pejalan kaki berjalan di trotoar dan lari bila ada bahaya.
- **Wanted 0–5**: naik karena curi mobil, pukul, dan ngebut di depan polisi; turun bila lama tak terlihat. Polisi spawn, mengejar, menabrak, dan menangkap. Wanted 5 = roadblock + unit lebih banyak.
- **6 misi berantai + cerita**: First Wheels, Courier Run (lawan waktu), The Pickup, Dockside Deal (lawan kru rival), Getaway Driver, King of Solmar.
- **Combat**: tinju + pistol pickup dengan amunisi terbatas, health, musuh AI.
- **HUD**: bintang wanted, health, cash, minimap (pemain / polisi / marker misi), teks objective, kecepatan saat nyetir, timer misi.
- **Menu start + pause + autosave** (localStorage: progres, cash, misi terbuka).
- **Audio**: WebAudio synth — mesin, sirene, blip, jingle misi. Tanpa file eksternal, tanpa network.
- **Scene hook (dev)**: `?scene=chase|drive|mission|foot` menyiapkan adegan itu untuk screenshot.

## Teknologi

- Canvas 2D + ES modules murni, tanpa library eksternal. Semua data berasal dari file di dalam `game/`.
- `main.ts` (Node stdlib only) memakai `buildDossier` dari `vendor/makefun-game.ts` untuk menulis `dossier.json` ke `out/`.

## Screenshot

1. `1-chase.jpg` — kejar-kejaran polisi, wanted, minimap, objective misi.
2. `2-drive.jpg` — kota dari dalam mobil.
3. `3-mission.jpg` — misi/story + combat di docks.
4. `4-foot.jpg` — jalan kaki + traffic di Old Town.
