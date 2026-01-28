"use client";

import { useEffect, useState } from "react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { ConnectionPicker } from "@/components/ConnectionPicker";

interface CreateFolderConfigProps {
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
  connectionId?: string;
}

interface Folder {
  id: string;
  name: string;
}

export function CreateFolderConfig({ config, onChange, connectionId }: CreateFolderConfigProps) {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCustomId, setShowCustomId] = useState(!!config?.customParentFolderId);

  useEffect(() => {
    if (!connectionId) return;

    const fetchFolders = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(
          `/api/integrations/google-drive/folders?connectionId=${encodeURIComponent(connectionId)}`
        );
        if (!response.ok) throw new Error("Failed to fetch folders");
        const data = await response.json();
        setFolders((data.folders as Folder[]) || []);
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : "Unknown error";
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    fetchFolders();
  }, [connectionId]);

  const handleFolderSelect = (folderId: string) => {
    onChange({
      ...config,
      parentFolderId: folderId,
      customParentFolderId: undefined,
    });
    setShowCustomId(false);
  };

  const handleCustomIdChange = (id: string) => {
    onChange({
      ...config,
      customParentFolderId: id,
    });
  };

  const handleFolderNameChange = (name: string) => {
    onChange({
      ...config,
      folderName: name,
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-sm font-medium">Google Drive Connection *</Label>
        <p className="text-xs text-gray-500 mb-2">Select your Google account</p>
        <ConnectionPicker
          provider="google"
          value={String(config?.connectionId || "")}
          onChange={(id) => onChange({ ...config, connectionId: id })}
        />
      </div>

      <div>
        <Label className="text-sm font-medium">Parent Folder</Label>
        <p className="text-xs text-gray-500 mb-2">Select where to create the folder (optional)</p>
        
        {loading && <p className="text-sm text-gray-600">Loading folders...</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}
        
        {!loading && !error && (
          <>
            <Select value={String(config?.parentFolderId || "root")} onValueChange={handleFolderSelect}>
              <SelectTrigger>
                <SelectValue placeholder="My Drive (root)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="root">My Drive (root)</SelectItem>
                {folders.map((folder) => (
                  <SelectItem key={folder.id} value={folder.id}>
                    {folder.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        )}

        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mt-2 text-xs"
          onClick={() => setShowCustomId(!showCustomId)}
        >
          {showCustomId ? "Use dropdown" : "Use custom folder ID"}
        </Button>

        {showCustomId && (
          <div className="mt-2">
            <Input
              type="text"
              placeholder="Paste folder ID"
              value={String(config?.customParentFolderId || "")}
              onChange={(e) => handleCustomIdChange(e.target.value)}
              className="text-sm"
            />
          </div>
        )}
      </div>

      <div>
        <Label htmlFor="folder-name" className="text-sm font-medium">
          Folder Name *
        </Label>
        <Input
          id="folder-name"
          type="text"
          placeholder="e.g., My New Folder"
          value={String(config?.folderName || "")}
          onChange={(e) => handleFolderNameChange(e.target.value)}
          className="mt-1"
        />
      </div>
    </div>
  );
}
