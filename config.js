// Site configuration.
//
// Leave SUPABASE_URL / SUPABASE_ANON_KEY empty to run in "demo mode":
// claims are saved only in the current browser (handy for previewing).
// Fill them in (see README.md) to share claims between everyone.
//
// The anon key is designed to be public — it only allows calling the three
// functions defined in supabase/schema.sql, nothing else.
window.LIST_CONFIG = {
  ownerName: "",            // e.g. "Alex" → shows as "Alex's Christmas List"
  title: "My Christmas List",
  subtitle: "Pick something, claim it, and it disappears for everyone else. No names are ever recorded.",
  year: 2026,
  SUPABASE_URL: "",
  SUPABASE_ANON_KEY: "",
};
