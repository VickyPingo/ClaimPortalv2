import { useEffect, useRef, useState } from 'react';
import {
  buildDraftKey,
  saveClaimDraft,
  loadClaimDraft,
  clearClaimDraft,
  ClaimDraftRecord,
} from '../lib/claimDraft';

const AUTOSAVE_DEBOUNCE_MS = 1200;

/**
 * Autosaves `data` (whatever fields the form wants remembered — including
 * File/Blob values like photos and voice notes) to IndexedDB as the client
 * fills in the form, and offers to restore it if they come back later.
 *
 * Usage in a claim form:
 *   const draft = useClaimDraft('burst_geyser', clientId, { step, burstDate, ... }, step === 'success');
 *   // draft.hasDraft / draft.draft.data  -> show a "Resume?" banner
 *   // draft.restore(setters)             -> call setters with saved values
 *   // draft.dismiss()                    -> client chose to start fresh
 *   // draft.clear()                      -> call after successful submit
 */
export function useClaimDraft(
  claimType: string,
  clientId: string | null | undefined,
  data: Record<string, unknown>,
  suspend: boolean
) {
  const draftKey = buildDraftKey(claimType, clientId);
  const [hasDraft, setHasDraft] = useState(false);
  const [draft, setDraft] = useState<ClaimDraftRecord | null>(null);
  const [checked, setChecked] = useState(false);
  const dismissedRef = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // On mount: check for an existing draft to offer resuming.
  useEffect(() => {
    let cancelled = false;
    loadClaimDraft(draftKey).then((record) => {
      if (cancelled) return;
      if (record) {
        setDraft(record);
        setHasDraft(true);
      }
      setChecked(true);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey]);

  // Debounced autosave whenever tracked fields change (after the client has
  // either dismissed the resume prompt or there was nothing to resume).
  useEffect(() => {
    if (!checked || suspend) return;
    if (hasDraft && !dismissedRef.current) return; // don't overwrite until they decide

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      saveClaimDraft(draftKey, claimType, data);
    }, AUTOSAVE_DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey, claimType, checked, suspend, hasDraft, JSON_SAFE_DEPS(data)]);

  const dismiss = () => {
    dismissedRef.current = true;
    setHasDraft(false);
  };

  const clear = () => {
    dismissedRef.current = true;
    setHasDraft(false);
    clearClaimDraft(draftKey);
  };

  return { checked, hasDraft, draft, dismiss, clear, draftKey };
}

// File/Blob values can't be JSON.stringify'd meaningfully (and shouldn't be
// diffed deeply on every keystroke), so build a lightweight dependency
// fingerprint: primitives compare by value, File/Blob compare by identity.
function JSON_SAFE_DEPS(data: Record<string, unknown>): string {
  return Object.entries(data)
    .map(([k, v]) => {
      if (v instanceof File || v instanceof Blob) {
        return `${k}:${(v as File).name ?? ''}:${v.size}:${v.type}`;
      }
      if (Array.isArray(v)) {
        return `${k}:[${v
          .map((item) =>
            item instanceof File || item instanceof Blob
              ? `${(item as File).name ?? ''}:${item.size}`
              : String(item)
          )
          .join(',')}]`;
      }
      if (v && typeof v === 'object') {
        try {
          return `${k}:${JSON.stringify(v)}`;
        } catch {
          return `${k}:[object]`;
        }
      }
      return `${k}:${String(v)}`;
    })
    .join('|');
}
