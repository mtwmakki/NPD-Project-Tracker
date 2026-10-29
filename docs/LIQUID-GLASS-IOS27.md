# iOS & iPadOS 27 kit — values read from Figma (file o60MuwCsAPSrUi1iQQSv9i)
## Colors (light / dark)
Accents: red #FF383C/#FF4245 orange #FF8D28/#FF9230 yellow #FFCC00/#FFD600 green #34C759/#30D158 mint #00C8B3/#00DAC3
 teal #00C3D0/#00D2E0 cyan #00C0E8/#3CD3FE blue #0088FF/#0091FF indigo #6155F5/#6D7CFF purple #CB30E0/#DB34F2 pink #FF2D55/#FF375F brown #AC7F5E/#B78A66
Labels: primary #000/#FFF; secondary rgba(60,60,67,.6)/rgba(235,235,245,.7); tertiary rgba(60,60,67,.3)/rgba(235,235,245,.3); quaternary rgba(60,60,67,.18)/rgba(235,235,245,.16)
Backgrounds: primary #FFF/#000 (elevated #1C1C1E); secondary #F2F2F7/#1C1C1E (elev #2C2C2E); tertiary #FFF/#2C2C2E (elev #3A3A3C)
Grouped: primary #F2F2F7/#000 (elev #1C1C1E); secondary #FFF/#1C1C1E (elev #2C2C2E); tertiary #F2F2F7/#2C2C2E (elev #3A3A3C)
Separators: opaque #C6C6C8/#38383A; non-opaque rgba(0,0,0,.12)/rgba(255,255,255,.17)
Grays (dark): gray #8E8E93 g2 #AEAEB2 g3 #48484A g4 #3A3A3C g5 #2C2C2E g6 #1C1C1E
Fills: SVG swatches (values not exposed) -> standard iOS: light rgba(120,120,128,.2/.16/.12/.08), dark rgba(120,120,128,.36/.32/.24/.18)
Footnote: 13/18 tracking -0.08, regular 400 / emphasized 590
## Type (Large/default Dynamic Type) size/leading tracking(px) — Regular 400, Emphasized 590 (titles 700)
Large Title 34/41 +0.40 (emph 700) | Title1 28/34 +0.38 (emph 700) | Title2 22/28 -0.26 (emph 700) | Title3 20/25 -0.45 (emph 590)
Headline 17/22 -0.43 w590 | Body 17/22 -0.43 | Callout 16/21 -0.31 | Subheadline 15/20 -0.23 | Footnote 13/18 -0.08 | Caption1 12/16 0 | Caption2 11/13 +0.06
## Lists (page 507:24675)
Row Regular h52, Tall h68 (title+subtitle). padding-x 16. Title Body 17/22 -0.43 labels/primary; subtitle Subheadline 15/20 -0.23 labels/secondary.
Separator: 1px top border, color separators/vibrant #E6E6E6 (light), inset from the content start (sits inside Contents, so starts after image/edit button).
Trailing: detail Body 17 labels/secondary; gap 16; chevron 17 semibold labels/tertiary w8; info/star symbols 22 blue.
Image regular 52 (pr8), tall 68. Edit button circle 22 accent; then pr16.
Header Nested: px16 py10, Headline 17/22 w590 labels/secondary (NOT uppercase). Prominent: Title3 20/25 w590 labels/primary + trailing action Subheadline 15 blue. Extra Prominent: Title2 22/28 bold.
Trailing date/time picker pill: fills/tertiary rgba(118,118,128,.12), padding 6px 11px, radius 100, Body 17. Stepper 92x32, halves fills/quaternary rgba(116,116,128,.08), capsule.
Toggle: 64x28 capsule, on = green #34C759, knob 38x24 white capsule, 2px inset.
Fills: quaternary rgba(116,116,128,.08), tertiary rgba(118,118,128,.12)
## iPhone screen: Inset grouped list (12740:24203) 402x874
Screen bg grouped/primary #F2F2F7 (dark #000). Content area padding 16 (top 16). Grouped table: bg grouped/secondary #FFF (dark #1C1C1E), radius 26, width = screen-32.
Status bar h62. Top toolbar at top 62: controls row px16, button groups h44 capsule (glass), symbols 36x36 inside, gap between symbols 20 (group px4/6), single button min-w44 px2.
Large title row px16, 34/41 bold, tracking .4, color labels-vibrant/primary #1A1A1A; then 20px subtitle slot; toolbar pb10, gap10 between controls and title.
Content starts at y=167 (=62 status + 44 controls + 10 + 41 title + 10). Scroll edge effect: 167px soft blur under the bars.
Glass control (light): shadow 1.25px 0 0 -0.75px #D0D0D0, -1.25px 0 0 -0.75px #D0D0D0, 0 0 0 .5px #E8E8E8, 0 8px 15px rgba(0,0,0,.02);
 fill stack: rgba(255,255,255,.25) + rgba(0,0,0,.25) base, rgba(68,68,68,.6) plus-lighter, rgba(248,248,248,.2) luminosity. Icon 17px medium(510) #1A1A1A.
Row-Button: centered Body 17 blue.
## iPhone Tab bar (12740:24077)
Floating, bottom: container px25 pt16 pb25, items-end, space-between (tab group left, separate search circle right).
Tab group: glass capsule (BG inset -4px around content, radius 1000, same glass stack), inner px2; each tab h54, icon 18 semibold #1A1A1A, label 10px/12 semibold; pt6 pb7 px8; gap .5.
Selected tab: pill bg fills-vibrant/tertiary #EDEDED (inset 0 -2px, radius 100); icon+label tinted accent blue. Tabs overlap mr-8.
Search: separate 54x54 glass circle.
Screen bg (non-grouped) backgrounds/primary #FFF. Content px16, starts below large title; Large title subtitle: Subheadline 15 medium(510) labels-vibrant/secondary #727272.

## Not read from the kit (Figma Starter plan call limit) — built from Apple's published HIG, check later
- Segmented control (32pt, tertiary-fill track, white thumb, 13pt semibold labels)
- Buttons (34pt capsules: tinted fill + accent label, or accent fill)
- Text fields (44pt, borderless, white on the grouped background)
- Sheets (grouped background, 38pt top corners on iPhone), menus/popovers (glass, 26pt corners)
- Compact title after scrolling (17pt semibold, left aligned beside the toolbar buttons)
- Dark-mode glass (light glass values are from the kit)
- iPad sidebar (kept as the icon column, floating glass)
- Desktop uses the iPadOS sizes from the kit (17pt body, 52pt rows, 44pt controls) with a floating glass icon sidebar.
  (macOS sizes, 13pt body / 32pt rows, were tried first and read far too small in a laptop browser.)

## Pages still to read when calls are available
iPad examples (Sidebar 12740:37613, List 12740:37605, Tab Bars 12740:23860, Toolbars 12740:23847),
Segmented Controls 507:24683, Buttons 507:24673, Text Fields 553:22762, Sheets 507:24684, Menus 507:24676,
Toolbars 507:25993 (Default/inline title 12740:24029), Materials 215:105157

## Liquid Glass spec (user directive, applied to the Liquid Glass style)
- Glass only on the interactive layer: tab bar, sidebar, toolbar buttons, sync pill, toolbar segmented control, menus, toasts, pickers.
  Content (cards, lists, forms) stays on solid grouped surfaces.
- Glass: backdrop blur(20px) saturate(180%); fill light rgba(255,255,255,.25) / dark rgba(20,20,20,.45);
  edge 1px rgba(255,255,255,.35); shadow 0 8px 32px rgba(0,0,0,.12) + inset 0 1px 1px rgba(255,255,255,.6).
  Menus/toasts/pickers that carry text use a thicker fill (.72) so their text stays readable over busy content.
- Motion: cubic-bezier(.175,.885,.32,1.275), 400ms, scaled by the Motion setting. The settings menu morphs open from its button;
  on phones the tab bar folds into a compact pill (current tab) while scrolling down and unfolds on scroll up or tap.
- Secondary text: rgba(0,0,0,.75) light / rgba(255,255,255,.85) dark (tertiary .45 / .55).
- Backdrop: soft blue / indigo / cyan glow behind the content so the glass picks up colour.
- Not done: overlay / plus-lighter blend layers (the saturate(180%) backdrop carries the colour bleed; extra blend layers lowered icon contrast).
