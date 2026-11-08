import { useState } from 'react';

import { reasonError } from '../utils/validation';
import { Button, FormAlert, TextField } from './ui';

type DecisionFormProps = {
  /** Label of the note field; the note is shown to the applicant and saved in the audit log. */
  label: string;
  required: boolean;
  approveLabel: string;
  rejectLabel: string;
  busy: 'approve' | 'reject' | null;
  error: string | null;
  onDecide: (decision: 'approve' | 'reject', note: string) => void;
};

/** A note plus approve and reject buttons, for claims, place changes and similar queues. */
export function DecisionForm({ label, required, approveLabel, rejectLabel, busy, error, onDecide }: DecisionFormProps) {
  const [note, setNote] = useState('');
  const [noteError, setNoteError] = useState<string | null>(null);

  function decide(decision: 'approve' | 'reject') {
    const found = reasonError(note, required);
    setNoteError(found);
    if (found) return;
    onDecide(decision, note.trim());
  }

  return (
    <div className="decision">
      <TextField
        label={label}
        value={note}
        maxLength={1000}
        onChange={(event) => {
          setNote(event.target.value);
          setNoteError(null);
        }}
        error={noteError}
        disabled={busy !== null}
      />
      <div className="form-actions">
        <Button size="small" busy={busy === 'approve'} disabled={busy !== null} onClick={() => decide('approve')}>
          {approveLabel}
        </Button>
        <Button size="small" variant="danger" busy={busy === 'reject'} disabled={busy !== null} onClick={() => decide('reject')}>
          {rejectLabel}
        </Button>
        <FormAlert message={error} />
      </div>
    </div>
  );
}
