import { useState } from 'react';
import { toast } from 'sonner';
import { Users, X, AlertCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { saveGroup } from '@/lib/localStore';
import type { Contact, Group } from '@/types/types';

interface CreateGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contacts: Contact[];
  currentUserId: string;
  onGroupCreated: () => void;
}

export function CreateGroupDialog({
  open,
  onOpenChange,
  contacts,
  currentUserId,
  onGroupCreated,
}: CreateGroupDialogProps) {
  const [groupName, setGroupName] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const toggleMember = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCreate = async () => {
    const name = groupName.trim();
    if (!name) { setError('Please enter a group name.'); return; }
    if (selectedIds.size === 0) { setError('Please select at least one member.'); return; }
    setSaving(true);
    setError('');
    try {
      const members = contacts
        .filter(c => selectedIds.has(c.id))
        .map(c => ({ userId: c.id, username: c.username }));

      const group: Group = {
        id: crypto.randomUUID(),
        name,
        creatorId: currentUserId,
        members,
        createdAt: Date.now(),
        conversationId: crypto.randomUUID(),
      };
      await saveGroup(group);
      toast.success(`Group "${name}" created with ${members.length} members.`);
      setGroupName('');
      setSelectedIds(new Set());
      onGroupCreated();
    } catch {
      toast.error('Failed to create group.');
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setGroupName('');
    setSelectedIds(new Set());
    setError('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <Users className="w-5 h-5 text-primary" />
            Create Encrypted Group
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Group data is stored locally in your encrypted vault.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label className="text-sm font-normal text-muted-foreground uppercase tracking-wider">
              Group Name
            </Label>
            <Input
              value={groupName}
              onChange={e => { setGroupName(e.target.value); setError(''); }}
              placeholder="Secure Team Alpha"
              className="bg-input border-border text-foreground placeholder:text-muted-foreground px-3"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-normal text-muted-foreground uppercase tracking-wider">
              Add Members from Contacts
            </Label>
            {contacts.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No contacts yet. Add contacts first to create a group.
              </p>
            ) : (
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {contacts.map(contact => {
                  const selected = selectedIds.has(contact.id);
                  return (
                    <label
                      key={contact.id}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors min-h-12 ${
                        selected
                          ? 'bg-primary/15 border border-primary/30'
                          : 'bg-secondary/50 border border-transparent hover:border-border'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => toggleMember(contact.id)}
                        className="accent-primary"
                      />
                      <div className="w-7 h-7 rounded-full bg-secondary border border-border flex items-center justify-center shrink-0">
                        <span className="text-xs font-bold text-foreground">
                          {contact.username.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <span className={`text-sm font-medium ${selected ? 'text-primary' : 'text-foreground'}`}>
                        {contact.username}
                      </span>
                      {selected && (
                        <button
                          type="button"
                          onClick={e => { e.preventDefault(); toggleMember(contact.id); }}
                          className="ml-auto text-muted-foreground hover:text-foreground"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          {error && (
            <p className="text-destructive text-xs flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />{error}
            </p>
          )}

          <Button
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={handleCreate}
            disabled={saving || !groupName.trim() || selectedIds.size === 0}
          >
            {saving ? (
              <span className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                Creating...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                Create Group ({selectedIds.size} members)
              </span>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
