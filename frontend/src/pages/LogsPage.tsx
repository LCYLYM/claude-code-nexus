import { useState, useEffect } from "react";
import {
  Box,
  Card,
  CardContent,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Alert,
  IconButton,
  Grid,
} from "@mui/material";
import { Refresh as RefreshIcon } from "@mui/icons-material";
import { useAuth } from "../hooks/useAuth";

interface LogEntry {
  id: string;
  requestModel: string;
  targetModel: string;
  requestTokens: number | null;
  responseTokens: number | null;
  totalTokens: number | null;
  latencyMs: number | null;
  statusCode: number;
  isSuccess: boolean;
  errorMessage: string | null;
  streamMode: boolean;
  createdAt: string;
}

interface LogStats {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  totalTokens: number;
  averageLatency: number;
}

export function LogsPage() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [stats, setStats] = useState<LogStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      fetchLogs();
      fetchStats();
    }
  }, [user]);

  const fetchLogs = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/logs?limit=50", {
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to fetch logs");
      }

      const data: any = await response.json();
      setLogs(data.logs || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch("/api/logs/stats", {
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to fetch stats");
      }

      const data: any = await response.json();
      setStats(data);
    } catch (err: any) {
      console.error("Failed to fetch stats:", err);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  if (!user) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="warning">Please login to view your logs</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", mb: 3 }}>
        <Typography variant="h4">Gateway Logs</Typography>
        <IconButton onClick={() => { fetchLogs(); fetchStats(); }}>
          <RefreshIcon />
        </IconButton>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Statistics Cards */}
      {stats && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  Total Requests
                </Typography>
                <Typography variant="h4">{stats.totalRequests}</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  Success Rate
                </Typography>
                <Typography variant="h4">
                  {stats.totalRequests > 0
                    ? ((stats.successfulRequests / stats.totalRequests) * 100).toFixed(1)
                    : 0}
                  %
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  Total Tokens
                </Typography>
                <Typography variant="h4">{stats.totalTokens.toLocaleString()}</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  Avg Latency
                </Typography>
                <Typography variant="h4">{Math.round(stats.averageLatency)}ms</Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      <Alert severity="info" sx={{ mb: 2 }}>
        This page shows your recent API requests and responses. Logs are kept for 30 days.
      </Alert>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Time</TableCell>
              <TableCell>Request Model</TableCell>
              <TableCell>Target Model</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Tokens</TableCell>
              <TableCell>Latency</TableCell>
              <TableCell>Mode</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {logs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  No logs available yet. Make some API requests to see them here.
                </TableCell>
              </TableRow>
            ) : (
              logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell>{formatDate(log.createdAt)}</TableCell>
                  <TableCell>{log.requestModel}</TableCell>
                  <TableCell>{log.targetModel}</TableCell>
                  <TableCell>
                    <Chip
                      label={log.isSuccess ? `${log.statusCode}` : `Error ${log.statusCode}`}
                      color={log.isSuccess ? "success" : "error"}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    {log.totalTokens !== null ? (
                      <>
                        {log.totalTokens}
                        <Typography variant="caption" display="block" color="textSecondary">
                          {log.requestTokens}/{log.responseTokens}
                        </Typography>
                      </>
                    ) : (
                      "N/A"
                    )}
                  </TableCell>
                  <TableCell>{log.latencyMs !== null ? `${log.latencyMs}ms` : "N/A"}</TableCell>
                  <TableCell>
                    <Chip label={log.streamMode ? "Stream" : "Standard"} size="small" />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
