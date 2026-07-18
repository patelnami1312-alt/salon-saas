import { useState } from 'react';
import {
  Box, Typography, Grid, Card, CardContent, CardActions, Button,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  IconButton, Chip, CircularProgress, Alert, Tooltip,
  Avatar, Divider,
} from '@mui/material';
import { Add, Edit, Delete, Category, ContentCut, ArrowBack } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import {
  useGetServiceCategoriesQuery,
  useCreateServiceCategoryMutation,
  useUpdateServiceCategoryMutation,
  useDeleteServiceCategoryMutation,
  useGetServicesQuery,
} from '@/features/api/apiSlice';
import toast from 'react-hot-toast';
import { v } from '@/utils/formValidation';
import type { ServiceCategory } from '@/types';

const PALETTE = [
  '#6C3FC5','#8B5CF6','#3B82F6','#06B6D4','#14B8A6',
  '#22C55E','#F59E0B','#F97316','#EF4444','#EC4899',
];

// ── Category Form Dialog ───────────────────────────────────────────────────────
function CategoryDialog({
  open, onClose, editing,
}: {
  open: boolean; onClose: () => void; editing: ServiceCategory | null;
}) {
  const [name, setName] = useState(editing?.category_name ?? '');
  const [desc, setDesc] = useState((editing as any)?.description ?? '');
  const [color, setColor] = useState(editing?.color_code ?? PALETTE[0]);
  const [nameErr, setNameErr] = useState('');

  const [create, { isLoading: creating }] = useCreateServiceCategoryMutation();
  const [update, { isLoading: updating }] = useUpdateServiceCategoryMutation();
  const saving = creating || updating;

  const handleClose = () => {
    setName(''); setDesc(''); setColor(PALETTE[0]); setNameErr('');
    onClose();
  };

  const handleSave = async () => {
    const err = v.required(name, 'Category name') || v.minLen(name, 2, 'Category name');
    if (err) { setNameErr(err); return; }
    try {
      if (editing) {
        await update({ id: editing.category_id, data: { category_name: name.trim(), description: desc, color_code: color } }).unwrap();
        toast.success('Category updated');
      } else {
        await create({ category_name: name.trim(), description: desc, color_code: color }).unwrap();
        toast.success('Category created');
      }
      handleClose();
    } catch (e: any) {
      toast.error(e?.data?.detail ?? 'Failed to save category');
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
      <DialogTitle sx={{ fontWeight: 700, pb: 1 }}>
        {editing ? 'Edit Category' : 'New Category'}
      </DialogTitle>
      <DialogContent>
        <TextField
          label="Category Name *" fullWidth autoFocus
          value={name}
          onChange={(e) => { setName(e.target.value); if (nameErr) setNameErr(''); }}
          error={!!nameErr} helperText={nameErr}
          sx={{ mt: 0.5, mb: 2 }}
        />
        <TextField
          label="Description (optional)" fullWidth multiline rows={2}
          value={desc} onChange={(e) => setDesc(e.target.value)}
          sx={{ mb: 2.5 }}
        />
        <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Color
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 1 }}>
          {PALETTE.map((c) => (
            <Box
              key={c} onClick={() => setColor(c)}
              sx={{
                width: 30, height: 30, borderRadius: '50%', bgcolor: c,
                cursor: 'pointer',
                outline: color === c ? `3px solid ${c}` : 'none',
                outlineOffset: 2,
                border: color === c ? '2px solid white' : '2px solid transparent',
                transition: 'transform .12s',
                '&:hover': { transform: 'scale(1.15)' },
              }}
            />
          ))}
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={handleClose} disabled={saving}>Cancel</Button>
        <Button variant="contained" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : editing ? 'Save Changes' : 'Create'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ── Delete Confirm Dialog ─────────────────────────────────────────────────────
function DeleteDialog({ cat, onClose }: { cat: ServiceCategory | null; onClose: () => void }) {
  const [del, { isLoading }] = useDeleteServiceCategoryMutation();
  if (!cat) return null;

  const handleDelete = async () => {
    try {
      await del(cat.category_id).unwrap();
      toast.success('Category deleted');
      onClose();
    } catch (e: any) {
      toast.error(e?.data?.detail ?? 'Failed to delete category');
    }
  };

  return (
    <Dialog open={!!cat} onClose={onClose} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
      <DialogTitle fontWeight={700}>Delete Category?</DialogTitle>
      <DialogContent>
        <Alert severity="warning" sx={{ mb: 1 }}>
          Deleting <strong>{cat.category_name}</strong> will hide it and all its services from new bookings.
        </Alert>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" color="error" onClick={handleDelete} disabled={isLoading}>
          {isLoading ? 'Deleting…' : 'Delete'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function ServiceCategoriesPage() {
  const navigate = useNavigate();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ServiceCategory | null>(null);
  const [deleting, setDeleting] = useState<ServiceCategory | null>(null);

  const { data: categories = [], isLoading } = useGetServiceCategoriesQuery();
  const { data: allServices = [] } = useGetServicesQuery({});

  const openEdit = (cat: ServiceCategory) => { setEditing(cat); setDialogOpen(true); };
  const handleDialogClose = () => { setDialogOpen(false); setEditing(null); };

  const serviceCount = (catId: number) =>
    (allServices as any[]).filter((s) => s.category_id === catId).length;

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <IconButton size="small" onClick={() => navigate('/services')} sx={{ border: '1px solid', borderColor: 'divider' }}>
            <ArrowBack fontSize="small" />
          </IconButton>
          <Box>
            <Typography variant="h5" fontWeight={700}>Service Categories</Typography>
            <Typography variant="body2" color="text.secondary">
              {categories.length} {categories.length === 1 ? 'category' : 'categories'}
            </Typography>
          </Box>
        </Box>
        <Button variant="contained" startIcon={<Add />} onClick={() => { setEditing(null); setDialogOpen(true); }}>
          Add Category
        </Button>
      </Box>

      {/* Loading */}
      {isLoading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      )}

      {/* Empty state */}
      {!isLoading && categories.length === 0 && (
        <Box sx={{
          textAlign: 'center', py: 10, border: '2px dashed #E5E7EB',
          borderRadius: 3,
        }}>
          <Category sx={{ fontSize: 56, color: '#D1D5DB', mb: 2 }} />
          <Typography variant="h6" fontWeight={600} color="text.secondary" mb={1}>
            No categories yet
          </Typography>
          <Typography variant="body2" color="text.disabled" mb={3}>
            Create a category to organise your services
          </Typography>
          <Button variant="contained" startIcon={<Add />} onClick={() => setDialogOpen(true)}>
            Add First Category
          </Button>
        </Box>
      )}

      {/* Grid */}
      {!isLoading && categories.length > 0 && (
        <Grid container spacing={2}>
          {categories.map((cat) => {
            const count = serviceCount(cat.category_id);
            const bg = cat.color_code ?? '#6C3FC5';
            return (
              <Grid item xs={12} sm={6} md={4} lg={3} key={cat.category_id}>
                <Card sx={{
                  height: '100%', display: 'flex', flexDirection: 'column',
                  border: '1px solid #F0EBFF',
                  transition: 'all .2s',
                  '&:hover': { transform: 'translateY(-2px)', boxShadow: `0 8px 24px ${bg}22`, borderColor: bg + '60' },
                }}>
                  <CardContent sx={{ flex: 1 }}>
                    {/* Color swatch header */}
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                      <Avatar sx={{ bgcolor: bg, width: 44, height: 44, boxShadow: `0 4px 12px ${bg}40` }}>
                        <Category sx={{ fontSize: 20 }} />
                      </Avatar>
                      <Chip
                        label={`${count} service${count !== 1 ? 's' : ''}`}
                        size="small"
                        icon={<ContentCut sx={{ fontSize: 12 }} />}
                        sx={{ bgcolor: bg + '15', color: bg, fontWeight: 700, fontSize: 11 }}
                      />
                    </Box>

                    <Typography variant="subtitle1" fontWeight={700} mb={0.5}>
                      {cat.category_name}
                    </Typography>
                    {(cat as any).description && (
                      <Typography variant="caption" color="text.secondary" display="block">
                        {(cat as any).description}
                      </Typography>
                    )}
                  </CardContent>

                  <Divider />
                  <CardActions sx={{ px: 1.5, py: 1, justifyContent: 'space-between' }}>
                    <Button
                      size="small" startIcon={<ContentCut sx={{ fontSize: 14 }} />}
                      onClick={() => navigate(`/services?category=${cat.category_id}`)}
                      sx={{ fontSize: 12, color: 'text.secondary' }}
                    >
                      View Services
                    </Button>
                    <Box>
                      <Tooltip title="Edit">
                        <IconButton size="small" onClick={() => openEdit(cat)}>
                          <Edit sx={{ fontSize: 16 }} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton size="small" color="error" onClick={() => setDeleting(cat)}>
                          <Delete sx={{ fontSize: 16 }} />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </CardActions>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}

      <CategoryDialog open={dialogOpen} onClose={handleDialogClose} editing={editing} />
      <DeleteDialog cat={deleting} onClose={() => setDeleting(null)} />
    </Box>
  );
}
