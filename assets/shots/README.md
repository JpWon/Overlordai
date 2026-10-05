# Game screenshots for the section-3 carousel

Drop a file in here named exactly as the pane expects and the pane picks it up — no code
change needed:

| file           | pane |
|----------------|------|
| `shot-02.jpg`  | 2    |
| `shot-04.jpg`  | 4    |
| `shot-06.jpg`  | 6    |

Panes 1, 3 and 5 are **Video** panes (pane 1 is the live dashboard demo in `assets/reels/`).

Want a different filename, or a clip instead of a still? Edit the `CARDS` array near the
bottom of `index.html` and set:

```js
img:    'assets/shots/control-01.jpg'            // a screenshot pane
video:  'assets/reels/my-clip.mp4',              // a clip pane
poster: 'assets/reels/my-clip-poster.jpg',
ratio:  '1462/816',                              // the clip's own shape — no letterbox bars
```

A pane whose file is missing keeps its purple gradient, so nothing ever renders empty.

Recommended for screenshots: 1600x1000, JPG or WebP, under ~400 KB each.
