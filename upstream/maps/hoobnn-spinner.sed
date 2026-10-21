# hoobnn-agent-mods paths -> showtime/. Only claude-code/spinner is tracked:
# upstream syncs its shared kit into claude-code/spinner/hooks/kit/, which is
# byte-identical to showtime/hooks/kit/ here, so the kit's own sources
# (claude-code/kit/) would only diff the same files a second time.
/^\(diff --git\|---\|+++\) /{
s# \([ab]\)/claude-code/spinner/# \1/showtime/#g
}
