"use client";

import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ConnectionPicker } from "@/components/ConnectionPicker";

interface SetSharingPreferenceConfigProps {
  config: any;
  onChange: (config: any) => void;
  connectionId?: string;
}

export function SetSharingPreferenceConfig({ config, onChange, connectionId }: SetSharingPreferenceConfigProps) {
  const [emailError, setEmailError] = useState<string | null>(null);

  const handleFileIdChange = (fileId: string) => {
    onChange({
      ...config,
      fileId,
    });
  };

  const handleRoleChange = (role: string) => {
    onChange({
      ...config,
      role,
    });
  };

  const handleScopeChange = (scope: string) => {
    onChange({
      ...config,
      scope,
      emailAddress: scope !== "private" ? undefined : config.emailAddress,
    });
  };

  const handleEmailChange = (email: string) => {
    setEmailError(null);
    
    if (email && !email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      setEmailError("Invalid email address");
    }

    onChange({
      ...config,
      emailAddress: email,
    });
  };

  const handleAllowDiscoveryChange = (checked: boolean) => {
    onChange({
      ...config,
      allowDiscovery: checked,
    });
  };

  const shouldShowEmail = config?.scope === "private";

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-sm font-medium">Google Drive Connection *</Label>
        <p className="text-xs text-gray-500 mb-2">Select your Google account</p>
        <ConnectionPicker
          provider="google"
          value={config?.connectionId || ""}
          onChange={(id) => onChange({ ...config, connectionId: id })}
        />
      </div>

      <div>
        <Label htmlFor="file-id" className="text-sm font-medium">
          File or Folder ID *
        </Label>
        <p className="text-xs text-gray-500 mb-2">
          Map from previous node output (e.g., from Create Folder)
        </p>
        <Input
          id="file-id"
          type="text"
          placeholder="e.g., {{steps.node_abc123.folderId}}"
          value={config?.fileId || ""}
          onChange={(e) => handleFileIdChange(e.target.value)}
          className="mt-1 text-sm"
        />
      </div>

      <div>
        <Label className="text-sm font-medium">Role *</Label>
        <p className="text-xs text-gray-500 mb-2">What level of access to grant</p>
        <Select value={config?.role || "viewer"} onValueChange={handleRoleChange}>
          <SelectTrigger>
            <SelectValue placeholder="Select role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="viewer">Viewer (read-only)</SelectItem>
            <SelectItem value="commenter">Commenter (can add comments)</SelectItem>
            <SelectItem value="editor">Editor (full editing rights)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label className="text-sm font-medium">Sharing Scope *</Label>
        <p className="text-xs text-gray-500 mb-2">Who can access this</p>
        <Select value={config?.scope || "anyone"} onValueChange={handleScopeChange}>
          <SelectTrigger>
            <SelectValue placeholder="Select sharing scope" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="private">Private (only specific person)</SelectItem>
            <SelectItem value="link">Anyone with link</SelectItem>
            <SelectItem value="anyone">Anyone (public)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {shouldShowEmail && (
        <div>
          <Label htmlFor="email" className="text-sm font-medium">
            Email Address *
          </Label>
          <p className="text-xs text-gray-500 mb-2">Who to share with</p>
          <Input
            id="email"
            type="email"
            placeholder="user@example.com"
            value={config?.emailAddress || ""}
            onChange={(e) => handleEmailChange(e.target.value)}
            className={`mt-1 text-sm ${emailError ? "border-red-500" : ""}`}
          />
          {emailError && <p className="text-xs text-red-600 mt-1">{emailError}</p>}
        </div>
      )}

      {config?.scope === "link" || config?.scope === "anyone" ? (
        <div className="flex items-center space-x-2">
          <Checkbox
            id="allow-discovery"
            checked={config?.allowDiscovery !== false}
            onCheckedChange={handleAllowDiscoveryChange}
          />
          <Label htmlFor="allow-discovery" className="text-sm font-normal cursor-pointer">
            Allow discovery in search results
          </Label>
        </div>
      ) : null}
    </div>
  );
}
