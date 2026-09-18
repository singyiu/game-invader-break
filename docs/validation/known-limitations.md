# Known limitations

- This candidate targets desktop/laptop play. Physical webcam qualification on the full Windows/macOS browser matrix is still pending; mobile and Firefox support are not claimed.
- Use one player in view, with a clearly visible relaxed hand and comfortable reach. The model detects hands, not verified player identity. A second person's hand can enter the control mapping.
- Tracking uncertainty freezes the game. Human trials still need to measure how often that interrupts ordinary play and whether the selected smoothing feels responsive.
- Camera/audio activation and reconnection require the browser's explicit button/permission flow. Gameplay and subsequent menus use hand position.
- The art and sound are original procedural assets. Human evaluation of final visual quality, sound mix, balance, accessibility, comfort and typical run length is still pending.
- Records live only in this browser's local storage; private browsing or cleared storage can remove them. No global leaderboard or cloud account.
- Offline installation/caching is not provided. First play requires the locally hosted model/runtime to load.

Public deployment also needs host security-header verification, model redistribution review and working-title clearance. Those are release tasks, not implied by a successful local build.
