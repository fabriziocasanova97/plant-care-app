# Plant Pal — ready to share by Friday, Nov 27

Today is Tuesday, Nov 24. Thursday is Thanksgiving, so the plan keeps Thursday free
and puts all build work on Tuesday and Wednesday.

Live app: https://fabriziocasanova97.github.io/plant-care-app/
What works today: find by name, photo ID (with the key), NC State care notes, watering
schedule and log, calendar reminders, winter mode, photo timeline, notes, flag, test
plants, one-tap setup link.

## Must have by Friday

| # | What | Who | When | Why |
|---|------|-----|------|-----|
| 1 | Fix the 3 important review findings: back arrow after saving lands on "Add a plant"; Save settings can wipe the key; a pasted setup link isn't saved until "Save settings" | Claude | Tue | She will hit the first one on day one |
| 2 | Fix the 3 small findings: double back press after the My plants tab, a confirmation for a first-time setup link, a setup link that follows the app's address | Claude | Tue | Cheap, and they remove odd moments |
| 3 | Ask the phone to keep the app's data (persistent storage) | Claude | Tue | Lowers the chance the phone clears her plants to free space |
| 4 | Undo after "Watered" (5-second toast), and delete a log entry | Claude | Tue | A mistaken tap currently can't be undone |
| 5 | Let her pick a photo from her library, not only the camera | Claude | Tue | She'll already have photos of her plants |
| 6 | **Real-phone test on your iPhone** (checklist below) | You | Wed | Never tested on a device; this is the biggest risk |
| 7 | Fix anything the phone test finds | Claude | Wed | Buffer for surprises |
| 8 | Remove the test plants on your phone; check her start is a clean, empty app | You | Wed | She should not see "Test" anything |
| 9 | Send her the link + setup link with a short note (draft below) | You | Fri | Hand-over |

## Should have (if Tuesday goes smoothly)

- **Backup / restore.** Export everything (plants, log, photos) to one file and import it. This
  protects against a lost or reset phone. About 1–2 hours of work.
- **A short "How it works" card** on first launch: add a plant, tap Watered, use winter mode.
  Three lines, dismissed once.

## Not by Friday (stays in NEXT.md)

- Push notifications (needs a Cloudflare or Vercel account and a small server; calendar
  reminders cover it for now)
- A second plant-info source for plants outside NC State's 426
- Rooms / grouping, search within her plants, smaller download size

## Wednesday phone-test checklist (about 15 minutes)

On your iPhone, in Safari, then from the home-screen icon:

1. Open the link and add it to your home screen. Open it from the icon.
2. **Settings → Share setup link** → send it to yourself → tap it. Then open the
   **home-screen** app → Settings: is the key there? (If not, paste the link in the key field.
   That is the fallback she'll use.)
3. **Scan → Take a photo** of a real plant: matches appear with percentages?
4. **Scan → choose from library** (after item 5): works?
5. Open a plant → **Add reminder to Calendar**: does Calendar appear in the share sheet,
   and does the event show up with an alert?
6. Tap **Watered now** → then **Undo** (after item 4).
7. Press back / swipe back from a plant page and from a full-screen photo.
8. Turn the phone to dark mode and look at one plant page.
9. **Settings → Remove test plants.** My plants should be empty.

Write down anything odd (a screenshot is perfect) and send it to me.

## Hand-over message (draft for Friday)

> Hi! I made you a little app for your plants 🌿
> 1. Open this on your phone: https://fabriziocasanova97.github.io/plant-care-app/
> 2. Tap Share → "Add to Home Screen" so it's an app icon.
> 3. Then tap this second link once to switch on photo identification: [setup link from Settings]
> Take a photo of a leaf to add a plant, and tap "Watered" when you water it. It tells you
> when each one is due. All the care tips come from NC State University's plant experts.
