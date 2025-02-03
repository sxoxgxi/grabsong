# Grab Song: A Gnome Shell Spotify Download Extension

A GNOME Shell extension that displays your currently playing Spotify song in the top panel and allows you to download it with a single click using `spotdl`.

## Features

- Displays current Spotify song in the GNOME top panel
- One-click download functionality
- Checkmark (✓) indicator for previously downloaded songs

## Images

![Screenshot 1](./media/normal.png)

---

![Screenshot 2](./media/downloading.png)

---

![Screenshot 3](./media/completed.png)

## Requirements

- GNOME Shell 45 or later
- spotdl (`pip install spotdl`)
- A working Spotify installation

## Installation

1. Install the required dependencies:

```bash
pip install spotdl
```

2. Clone this repository:

```bash
git clone https://github.com/sxoxgxi/grabsong
cd grabsong
```

3. Install the extension:

```bash
make install
```

Or manually:

```bash
mkdir -p ~/.local/share/gnome-shell/extensions/grabsong@sxoxgxi
cp -r * ~/.local/share/gnome-shell/extensions/grabsong@sxoxgxi
```

4. Restart GNOME Shell:

   - Press Alt+F2
   - Type 'r' and press Enter
   - Or log out and log back in

5. Enable the extension using GNOME Extensions app or Extensions Manager

## Usage

1. Play a song on Spotify
2. The song title will appear in your top panel
3. Click the song title to download it
4. Downloaded songs will be saved to `~/Music`
5. A checkmark (✓) will appear next to previously downloaded songs

## Troubleshooting

- If no song appears in the panel, make sure Spotify is running
- If downloads fail, check that spotdl is installed correctly
- For permission errors, ensure your user has write access to `~/Music`

## Todo

- [ ] Add support for other music players.
- [ ] Create a UI for the extension.
- [ ] Add support for file location customization.
- [ ] Sync download status with locally available songs.

## Contributing

Pull requests are welcome.

## License

[MIT](LICENSE)
