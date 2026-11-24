// Site configuration.
//
// Leave SUPABASE_URL / SUPABASE_ANON_KEY empty to run in "demo mode":
// claims are saved only in the current browser (handy for previewing).
// Fill them in (see README.md) to share claims between everyone.
//
// The anon key is designed to be public — it only allows calling the three
// functions defined in supabase/schema.sql, nothing else.
window.LIST_CONFIG = {
  ownerName: "Parker",      // shows as "Parker's Christmas List"
  title: "Parker's Christmas List",
  subtitle: "Pick something, claim it, and it's greyed out for everyone else so nobody doubles up.",
  year: 2026,
  SUPABASE_URL: "https://dmajaqiwwopadwhquhrx.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_p8jaCa6e0Uc7gN0v0p7K5Q_Rb3Zl8UU",
};
