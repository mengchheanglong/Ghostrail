import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export function EditableField({
  label, value, onSave, multiline = false, placeholder = '', fieldId,
}: {
  label: string;
  value: string;
  onSave: (val: string) => Promise<void>;
  multiline?: boolean;
  placeholder?: string;
  /** Base ID for test selectors, e.g. "goal" → #goalSection, #goalDisplay, #editGoalBtn, etc. */
  fieldId?: string;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editVal, setEditVal]     = useState(value);
  const [isSaving, setIsSaving]   = useState(false);
  const [error, setError]         = useState('');

  const handleSave = async () => {
    setError('');
    setIsSaving(true);
    try {
      await onSave(editVal);
      setIsEditing(false);
    } catch (err: any) {
      setError(err.message || 'Error saving');
    } finally {
      setIsSaving(false);
    }
  };

  const cancel = () => { setEditVal(value); setIsEditing(false); setError(''); };

  // Generate test-facing IDs from fieldId
  const sectionId    = fieldId ? `${fieldId}Section`    : undefined;
  const displayId    = fieldId ? `${fieldId}Display`    : undefined;
  const editBtnId    = fieldId ? `edit${fieldId.charAt(0).toUpperCase() + fieldId.slice(1)}Btn` : undefined;
  const editorId     = fieldId ? `${fieldId}Editor`     : undefined;
  const editInputId  = fieldId ? `${fieldId}EditInput`  : undefined;
  const saveBtnId    = fieldId ? `save${fieldId.charAt(0).toUpperCase() + fieldId.slice(1)}Btn` : undefined;

  // Special case: "notes" uses #notesInput instead of #notesEditInput
  const resolvedInputId = fieldId === 'notes' ? 'notesInput' : editInputId;

  return (
    <div id={sectionId} style={{ marginBottom: '20px' }}>
      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <p className="field-label" style={{ margin: 0 }}>{label}</p>
        {!isEditing && (
          <button
            id={editBtnId}
            className="btn btn-ghost"
            style={{ padding: '3px 10px', fontSize: '0.72rem' }}
            onClick={() => { setEditVal(value); setIsEditing(true); }}
          >
            Edit
          </button>
        )}
      </div>

      <AnimatePresence mode="wait">
        {!isEditing ? (
          <motion.div key="view" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {value ? (
              <p id={displayId} style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                {value}
              </p>
            ) : (
              <p id={displayId} className="muted" style={{ margin: 0, fontSize: '0.82rem', fontStyle: 'italic' }}>
                {placeholder || `No ${label.toLowerCase()} set.`}
              </p>
            )}
          </motion.div>
        ) : (
          <motion.div id={editorId} key="edit" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}
          >
            {multiline ? (
              <textarea
                id={resolvedInputId}
                value={editVal}
                onChange={e => setEditVal(e.target.value)}
                disabled={isSaving}
                placeholder={placeholder}
                style={{ minHeight: '100px' }}
                autoFocus
              />
            ) : (
              <input
                id={resolvedInputId}
                type="text"
                value={editVal}
                onChange={e => setEditVal(e.target.value)}
                disabled={isSaving}
                placeholder={placeholder}
                autoFocus
              />
            )}
            {error && <div className="alert alert-error">{error}</div>}
            <div style={{ display: 'flex', gap: '6px' }}>
              <button id={saveBtnId} className="btn btn-primary" style={{ padding: '6px 14px', fontSize: '0.82rem' }} onClick={handleSave} disabled={isSaving}>
                {isSaving ? 'Saving…' : 'Save'}
              </button>
              <button className="btn btn-ghost" style={{ padding: '6px 14px', fontSize: '0.82rem' }} onClick={cancel} disabled={isSaving}>
                Cancel
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
