set shell := ["bash", "-eu", "-o", "pipefail", "-c"]

default:
  @just --list

checkpoint objective last next blockers='' files='' commands='':
  node scripts/session-checkpoint.mjs \
    --objective "{{objective}}" \
    --last "{{last}}" \
    --next "{{next}}" \
    --blockers "{{blockers}}" \
    --files "{{files}}" \
    --commands "{{commands}}"

sync-master:
  node scripts/generate-master-tracker.mjs

resume:
  node scripts/resume-session.mjs

check-tracking:
  node scripts/check-tracking-files.mjs

close-session objective last next blockers='' files='' commands='':
  just checkpoint "{{objective}}" "{{last}}" "{{next}}" "{{blockers}}" "{{files}}" "{{commands}}"
  just sync-master
  just check-tracking
