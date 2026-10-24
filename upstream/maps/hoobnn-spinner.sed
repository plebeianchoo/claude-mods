# hoobnn-agent-mods paths -> showtime/. Only claude-code/spinner is tracked:
# upstream syncs its shared kit into claude-code/spinner/hooks/kit/, which is
# byte-identical to showtime/hooks/kit/ here, so the kit's own sources
# (claude-code/kit/) would only diff the same files a second time.
/^\(diff --git\|---\|+++\) /{
# Moved files, before the generic rule: scenes.ts became hooks/themes.ts (the
# per-theme files are new here); audio.ts is gone, so it maps to a path that
# does not exist and triage reports "unused".
s#claude-code/spinner/hooks/scenes\.ts#showtime/hooks/themes.ts#g
s#claude-code/spinner/hooks/audio\.ts#showtime/hooks/attic/audio.ts#g
s# \([ab]\)/claude-code/spinner/# \1/showtime/#g
s#/showtime/tests/spinner\.test\.tsx#/showtime/tests/showtime.test.tsx#g
}
