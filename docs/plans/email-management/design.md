# Email management: design

The screens for [ADR 0030](../../decisions/0030-email-management.md),
drawn on the [design canvas](https://claude.ai/artifact/5XvjMqxbvEEtCYA4dm8Qgt).
Its **Olympus** page is the design; the **First draft** page is the
earlier, unstyled pass, kept for reference. Senders, subjects and counts
on the canvas are sample data.

The look is the site's: the `#001529` header with the logo, the 80 px
main menu, a collapsed `#324354` sub-menu for Mail (Inbox,
Re-classification, Statistics, Clusters), the dark chevron breadcrumbs,
AntD 6 components in their standard style, and Highcharts for charts.

## How labels are shown

One set of AntD tags, on every screen:

| Tag                     | Means                                      |
| ----------------------- | ------------------------------------------ |
| Default                 | A label the message has now                |
| Blue, `+`               | A suggested label to add, with confidence  |
| Volcano, struck through | A suggested label to remove                |
| Gold, dashed            | A workflow state (`Bills/Payable`)         |
| Green                   | Approved, or a label created in the picker |
| Faded                   | A suggestion unticked, so it won't apply   |

A suggestion below its label's threshold is listed but unticked.

## Home page: the Mail widget

In the middle column of the home page's three, between Goals and
Weather, built like the Goals widget: the heading with Go to Mail, tabs
on the blue rule with counts (To review, Unread, Approved), the date line
with Accept all ≥ 90 %, then a row per message (unread dot, sender, date,
subject, current → suggested labels, a round accept button, a chevron).

A row expands in place, one at a time, since the widget has no room for
a side panel:

- sender address, time and thread size;
- each suggestion with its checkbox, confidence bar and reason ("sender
  history: 47 of 48 earlier messages");
- the label picker;
- Archive, Mark read, Whole thread;
- Approve & apply, Skip, Open message.

Approving folds the labels into the row, marks it Approved and offers
Undo. The footer links to the rest in Mail.

## Mail › Inbox

Title and subtitle, Mark read, Archive and Accept all ≥ 90 %; a statistics
strip (in inbox, to review, high confidence, no suggestion, approved
today); a segmented filter, search and minimum confidence; a selection
bar; then an AntD table (From, Subject, Current labels, Suggested,
Received, actions) whose rows expand into the same review panel as the
widget's, laid out in two columns.

## The label picker

An AntD Select in multiple mode, as the Goals tag picker is:

- Before typing it lists Suggested (with confidence), On this message,
  Often used for this sender, and Recent.
- Typing matches the whole path in order ("shret" finds
  `Shopping/Returns`), parents dimmed; ties go to the more used label.
- Enter toggles and keeps the list open; Backspace in an empty field
  removes the last label; Esc clears, then closes.
- Picking a state replaces its family's other state (`Paid` replaces
  `Payable`), and says so.
- Picking a retired label applies its merge target, and says so.
- Typing a path that does not exist offers to create it, saying where it
  goes; it is written to Gmail on apply.
- The Changes line shows what applying will add and remove.

**Bulk** (from a table selection): each label's checkbox has three
states, with "on 7 of 12" or "adding to 5 · already on 7", and the
changes say how many messages each affects.

## Mail › Re-classification

Statistics strip (suggested changes, high confidence, processed, merge
candidates, split suggestions), then the label tree as a table: messages,
suggested changes in and out as a bar, how many are ≥ 90 %, processed,
flags (merge candidate, split suggested, workflow state, needs a label),
Review. Merge candidates follow as cards (from → into, sender overlap,
messages moved, why; Preview merge, Dismiss).

### A label's review

Breadcrumb Mail › Re-classification › the label. The processed bar; a
split alert with the proposed sub-labels and their counts (Preview,
Create sub-labels); filters (only proposed changes, change type, minimum
confidence, status, search); the selection bar (Apply suggested changes,
Mark processed, no change); the table of messages with current labels,
the suggested change, confidence and status. Applied rows become
Processed.

## Mail › Statistics

Range (12 months, 3 years, all time) and scope; a statistics strip
(messages, labels in use, distinct senders, unlabelled); top senders and
top labels as bar charts; sender activity by year as a line chart for the
top senders; label activity by year as a heatmap, where a label fading
as a similar one rises marks a change in practice.

## Mail › Clusters

A scatter of messages placed by similarity (a dot per about 50), coloured
by current or suggested label, clusters named on the map. The side panel
shows the selected cluster: its label mix and purity, top senders and the
suggestion it leads to, with a link to re-classification; then a list of
clusters worth a look.

## Not drawn yet

Connecting the mail account; label settings (kind, family, transitions,
merge target, threshold) and star meanings (which icon means attention,
which done); stars on the rows, beside the labels, and star changes in
suggestions; the change log and undo; open payables;
filter proposals; the audit's star findings; empty, loading and error
states.

## Open

1. Mail's place, now that it is part of Minerva (2026-10-05): its own
   entry in the main menu, between Dionysus and Tools, as drawn, or an
   entry inside Minerva's menu.
2. The picker's two keys beyond AntD's own: Tab completes the path to
   the next `/`, and ⌘↵ applies. They need a key handler on the Select's
   input; without them the picker is stock AntD.
3. Whether Enter should pick and close (one label is the usual case),
   with Shift+Enter to keep picking.
