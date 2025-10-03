import { useState, useEffect } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  TextField,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Switch,
  FormControlLabel,
  Alert,
} from "@mui/material";
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Refresh as RefreshIcon,
} from "@mui/icons-material";
import { useAuth } from "../hooks/useAuth";

interface ProviderKey {
  id: string;
  keyName: string;
  baseUrl: string;
  priority: number;
  weight: number;
  enabled: boolean;
  failureCount: number;
  lastUsedAt: string | null;
  totalRequests: number;
  successfulRequests: number;
  createdAt: string;
  updatedAt: string;
}

export function KeysPage() {
  const { user } = useAuth();
  const [keys, setKeys] = useState<ProviderKey[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingKey, setEditingKey] = useState<ProviderKey | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    keyName: "",
    apiKey: "",
    baseUrl: "",
    priority: 0,
    weight: 1,
    enabled: true,
  });

  useEffect(() => {
    if (user) {
      fetchKeys();
    }
  }, [user]);

  const fetchKeys = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/keys", {
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to fetch keys");
      }

      const data: any = await response.json();
      setKeys(data.keys || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (key?: ProviderKey) => {
    if (key) {
      setEditingKey(key);
      setFormData({
        keyName: key.keyName,
        apiKey: "", // Don't pre-fill API key for security
        baseUrl: key.baseUrl,
        priority: key.priority,
        weight: key.weight,
        enabled: key.enabled,
      });
    } else {
      setEditingKey(null);
      setFormData({
        keyName: "",
        apiKey: "",
        baseUrl: "",
        priority: 0,
        weight: 1,
        enabled: true,
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingKey(null);
  };

  const handleSave = async () => {
    setError(null);
    setSuccess(null);

    try {
      const url = editingKey ? `/api/keys/${editingKey.id}` : "/api/keys";
      const method = editingKey ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData: any = await response.json();
        throw new Error(errorData.error || "Failed to save key");
      }

      setSuccess(editingKey ? "Key updated successfully" : "Key created successfully");
      handleCloseDialog();
      fetchKeys();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDelete = async (keyId: string) => {
    if (!confirm("Are you sure you want to delete this key?")) {
      return;
    }

    setError(null);
    try {
      const response = await fetch(`/api/keys/${keyId}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to delete key");
      }

      setSuccess("Key deleted successfully");
      fetchKeys();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const calculateSuccessRate = (key: ProviderKey) => {
    if (key.totalRequests === 0) return "N/A";
    return ((key.successfulRequests / key.totalRequests) * 100).toFixed(1) + "%";
  };

  if (!user) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="warning">Please login to manage your API keys</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", mb: 3 }}>
        <Typography variant="h4">Provider Keys Management</Typography>
        <Box>
          <IconButton onClick={fetchKeys} sx={{ mr: 1 }}>
            <RefreshIcon />
          </IconButton>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpenDialog()}>
            Add Key
          </Button>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      <Alert severity="info" sx={{ mb: 2 }}>
        Multi-key rotation allows you to configure multiple API keys for load balancing and automatic failover. Keys
        are selected based on priority and weight.
      </Alert>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Base URL</TableCell>
              <TableCell>Priority</TableCell>
              <TableCell>Weight</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Success Rate</TableCell>
              <TableCell>Requests</TableCell>
              <TableCell>Last Used</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {keys.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} align="center">
                  No keys configured. Add your first key to enable multi-key rotation.
                </TableCell>
              </TableRow>
            ) : (
              keys.map((key) => (
                <TableRow key={key.id}>
                  <TableCell>{key.keyName}</TableCell>
                  <TableCell>{key.baseUrl}</TableCell>
                  <TableCell>{key.priority}</TableCell>
                  <TableCell>{key.weight}</TableCell>
                  <TableCell>
                    <Chip
                      label={key.enabled ? "Enabled" : "Disabled"}
                      color={key.enabled ? "success" : "default"}
                      size="small"
                    />
                    {key.failureCount > 0 && (
                      <Chip label={`${key.failureCount} failures`} color="error" size="small" sx={{ ml: 1 }} />
                    )}
                  </TableCell>
                  <TableCell>{calculateSuccessRate(key)}</TableCell>
                  <TableCell>{key.totalRequests}</TableCell>
                  <TableCell>{key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleString() : "Never"}</TableCell>
                  <TableCell>
                    <IconButton size="small" onClick={() => handleOpenDialog(key)}>
                      <EditIcon />
                    </IconButton>
                    <IconButton size="small" onClick={() => handleDelete(key.id)}>
                      <DeleteIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Add/Edit Dialog */}
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>{editingKey ? "Edit Provider Key" : "Add Provider Key"}</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Key Name"
            value={formData.keyName}
            onChange={(e) => setFormData({ ...formData, keyName: e.target.value })}
            sx={{ mt: 2, mb: 2 }}
          />
          <TextField
            fullWidth
            label="API Key"
            type="password"
            value={formData.apiKey}
            onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
            helperText={editingKey ? "Leave empty to keep current key" : ""}
            sx={{ mb: 2 }}
          />
          <TextField
            fullWidth
            label="Base URL"
            value={formData.baseUrl}
            onChange={(e) => setFormData({ ...formData, baseUrl: e.target.value })}
            sx={{ mb: 2 }}
          />
          <TextField
            fullWidth
            label="Priority"
            type="number"
            value={formData.priority}
            onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) })}
            helperText="Higher priority keys are used first"
            sx={{ mb: 2 }}
          />
          <TextField
            fullWidth
            label="Weight"
            type="number"
            value={formData.weight}
            onChange={(e) => setFormData({ ...formData, weight: parseInt(e.target.value) })}
            helperText="Weight for load balancing (higher = more requests)"
            sx={{ mb: 2 }}
          />
          <FormControlLabel
            control={
              <Switch checked={formData.enabled} onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })} />
            }
            label="Enabled"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button onClick={handleSave} variant="contained">
            {editingKey ? "Update" : "Create"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
