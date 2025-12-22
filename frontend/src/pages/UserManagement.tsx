import React, { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Switch,
  FormControlLabel
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import BlockIcon from '@mui/icons-material/Block';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import type { SystemUser } from '../types';

export const UserManagement = () => {
  const { user } = useAuth();
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; user: SystemUser | null }>({ open: false, user: null });

  useEffect(() => {
    if (user?.role === 'admin') {
      fetchUsers();
    } else {
      setError('Доступ запрещен. Только администратор может просматривать эту страницу.');
      setLoading(false);
    }
  }, [user]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await api.get<SystemUser[]>('/users');
      setUsers(response.data);
      setError('');
    } catch (err: any) {
      setError('Не удалось загрузить список пользователей');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteDialog.user) return;

    try {
      await api.delete(`/users/${deleteDialog.user.userId}`);
      setSuccessMessage(`Пользователь ${deleteDialog.user.username} удален`);
      setDeleteDialog({ open: false, user: null });
      fetchUsers();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Ошибка удаления пользователя');
    }
  };

  const handleToggleBlock = async (userId: number, currentBlocked: boolean) => {
    try {
      await api.put(`/users/${userId}/block`, !currentBlocked);
      setSuccessMessage(`Пользователь ${currentBlocked ? 'разблокирован' : 'заблокирован'}`);
      fetchUsers();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Ошибка изменения статуса пользователя');
    }
  };

  if (user?.role !== 'admin') {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">Доступ запрещен. Только администратор может просматривать эту страницу.</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Управление пользователями
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {successMessage && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccessMessage('')}>
          {successMessage}
        </Alert>
      )}

      {loading ? (
        <Typography>Загрузка...</Typography>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>ID</TableCell>
                <TableCell>Имя пользователя</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Полное имя</TableCell>
                <TableCell>Роль</TableCell>
                <TableCell>Статус</TableCell>
                <TableCell>Дата регистрации</TableCell>
                <TableCell align="right">Действия</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.userId}>
                  <TableCell>{u.userId}</TableCell>
                  <TableCell>{u.username}</TableCell>
                  <TableCell>{u.email}</TableCell>
                  <TableCell>{u.fullName || '-'}</TableCell>
                  <TableCell>
                    <Chip
                      label={u.role === 'admin' ? 'Администратор' : 'Пользователь'}
                      color={u.role === 'admin' ? 'error' : 'default'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={u.isBlocked ? 'Заблокирован' : 'Активен'}
                      color={u.isBlocked ? 'error' : 'success'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    {u.createdAt ? new Date(u.createdAt).toLocaleDateString('ru-RU') : '-'}
                  </TableCell>
                  <TableCell align="right">
                    <Box display="flex" gap={1} justifyContent="flex-end">
                      <FormControlLabel
                        control={
                          <Switch
                            checked={!u.isBlocked}
                            onChange={() => handleToggleBlock(u.userId, u.isBlocked)}
                            disabled={u.userId === user?.userId || u.role === 'admin'}
                            size="small"
                          />
                        }
                        label=""
                      />
                      <IconButton
                        color="error"
                        size="small"
                        onClick={() => setDeleteDialog({ open: true, user: u })}
                        disabled={u.userId === user?.userId || u.role === 'admin'}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={deleteDialog.open} onClose={() => setDeleteDialog({ open: false, user: null })}>
        <DialogTitle>Подтверждение удаления</DialogTitle>
        <DialogContent>
          <Typography>
            Вы уверены, что хотите удалить пользователя <strong>{deleteDialog.user?.username}</strong>?
            Это действие нельзя отменить.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialog({ open: false, user: null })}>Отмена</Button>
          <Button onClick={handleDelete} color="error" variant="contained">
            Удалить
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};




