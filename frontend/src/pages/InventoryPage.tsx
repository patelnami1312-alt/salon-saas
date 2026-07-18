import { useState } from 'react';
import ComingSoon from '@/components/ComingSoon';
import {
  Box, Card, Typography, Button, TextField, InputAdornment, Grid,
  Chip, Tabs, Tab, LinearProgress, Alert, Dialog, DialogTitle,
  DialogContent, DialogActions, FormControlLabel, Switch,
} from '@mui/material';
import { DataGrid, type GridColDef } from '@mui/x-data-grid';
import { Search, Add, Warning, Inventory2 as Inventory2Icon } from '@mui/icons-material';
import NoRowsOverlay from '@/components/NoRowsOverlay';
import { useGetProductsQuery, useGetStockLevelsQuery, useCreateProductMutation } from '@/features/api/apiSlice';
import { useAppSelector } from '@/app/hooks';
import { useSalon } from '@/context/SalonContext';
import toast from 'react-hot-toast';
import { v, hasNoErrors, mapBackendError } from '@/utils/formValidation';

interface InventoryPageProps {
  defaultTab?: number;
}

const EMPTY_FORM = {
  product_name: '', sku: '', description: '',
  cost_price: '', sale_price: '', tax_percent: '0',
  is_for_sale: true, is_for_use: false,
};
const EMPTY_ERRORS = { product_name: '', sale_price: '', cost_price: '', tax_percent: '' };

function validateForm(form: typeof EMPTY_FORM) {
  return {
    product_name: v.required(form.product_name, 'Product name') || v.minLen(form.product_name, 2, 'Product name') || v.maxLen(form.product_name, 200, 'Product name'),
    sale_price: v.required(form.sale_price, 'Sale price') || v.positiveNumber(form.sale_price, 'Sale price'),
    cost_price: form.cost_price ? v.nonNegative(form.cost_price, 'Cost price') : '',
    tax_percent: v.percent(form.tax_percent, 'Tax'),
  };
}

export default function InventoryPage({ defaultTab = 0 }: InventoryPageProps) {
  const { formatCurrency } = useSalon();
  const [tab, setTab] = useState(defaultTab);
  const [search, setSearch] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [productForm, setProductForm] = useState(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState(EMPTY_ERRORS);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitError, setSubmitError] = useState('');

  const branchId = useAppSelector((s) => s.dashboard.selectedBranchId) ?? undefined;

  const { data: products, isLoading: prodLoading } = useGetProductsQuery({ search, page_size: 50 });
  const { data: stock, isLoading: stockLoading } = useGetStockLevelsQuery(branchId ?? 0, { skip: !branchId });
  const [createProduct, { isLoading: creating }] = useCreateProductMutation();

  const handleBlur = (field: string) => {
    setTouched((p) => ({ ...p, [field]: true }));
    setFieldErrors(validateForm(productForm));
  };

  const handleChange = (field: keyof typeof EMPTY_FORM, value: string) => {
    const next = { ...productForm, [field]: value };
    setProductForm(next);
    if (touched[field]) setFieldErrors(validateForm(next));
  };

  const handleClose = () => {
    setAddOpen(false);
    setProductForm(EMPTY_FORM);
    setFieldErrors(EMPTY_ERRORS);
    setTouched({});
    setSubmitError('');
  };

  const handleAddProduct = async () => {
    const allTouched = Object.keys(EMPTY_ERRORS).reduce((a, k) => ({ ...a, [k]: true }), {} as Record<string, boolean>);
    setTouched(allTouched);
    const errs = validateForm(productForm);
    setFieldErrors(errs);
    if (!hasNoErrors(errs)) return;
    setSubmitError('');
    try {
      await createProduct({
        product_name: productForm.product_name.trim(),
        sku: productForm.sku || undefined,
        description: productForm.description || undefined,
        cost_price: parseFloat(productForm.cost_price) || 0,
        sale_price: parseFloat(productForm.sale_price),
        tax_percent: parseFloat(productForm.tax_percent) || 0,
        is_for_sale: productForm.is_for_sale,
        is_for_use: productForm.is_for_use,
      }).unwrap();
      toast.success('Product added');
      handleClose();
    } catch (err: unknown) {
      const { fieldErrors: be, general } = mapBackendError(err, {
        product_name: 'product_name',
        'already exists': 'product_name',
        sku: 'product_name',
        sale_price: 'sale_price',
        cost_price: 'cost_price',
        tax: 'tax_percent',
      });
      setFieldErrors((p) => ({ ...p, ...be }));
      setSubmitError(general);
    }
  };

  const lowStockCount = stock?.low_stock_count || 0;

  const productColumns: GridColDef[] = [
    { field: 'product_name', headerName: 'Product', flex: 1.5, renderCell: (p) => <Typography variant="body2" fontWeight={600}>{p.value}</Typography> },
    { field: 'sku', headerName: 'SKU', flex: 0.9, renderCell: (p) => <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>{p.value || '—'}</Typography> },
    { field: 'cost_price', headerName: 'Cost', flex: 0.8, type: 'number', align: 'right', headerAlign: 'right', valueFormatter: (v: number) => formatCurrency(v) },
    { field: 'sale_price', headerName: 'Sale Price', flex: 0.8, type: 'number', align: 'right', headerAlign: 'right', renderCell: (p) => <Typography variant="body2" fontWeight={600}>{formatCurrency(p.value as number)}</Typography> },
    { field: 'tax_percent', headerName: 'Tax', flex: 0.5, type: 'number', align: 'center', headerAlign: 'center', valueFormatter: (v: number) => `${v}%` },
    {
      field: 'usage',
      headerName: 'Usage',
      flex: 0.8,
      sortable: false,
      align: 'center',
      headerAlign: 'center',
      renderCell: (params) => (
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          {params.row.is_for_sale && <Chip label="Sale" size="small" color="primary" variant="outlined" />}
          {params.row.is_for_use && <Chip label="Use" size="small" color="secondary" variant="outlined" />}
        </Box>
      ),
    },
    {
      field: 'is_active',
      headerName: 'Status',
      flex: 0.7,
      align: 'center',
      headerAlign: 'center',
      renderCell: (p) => <Chip label={p.value ? 'Active' : 'Inactive'} size="small" color={p.value ? 'success' : 'default'} />,
    },
  ];

  const stockColumns: GridColDef[] = [
    {
      field: 'product_name',
      headerName: 'Product',
      flex: 1.5,
      renderCell: (params) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {params.row.is_low_stock && <Warning sx={{ fontSize: 16, color: 'warning.main' }} />}
          <Typography variant="body2" fontWeight={params.row.is_low_stock ? 700 : 400}>{params.value}</Typography>
        </Box>
      ),
    },
    { field: 'sku', headerName: 'SKU', flex: 0.8, renderCell: (p) => <Typography sx={{ fontFamily: 'monospace', fontSize: 12 }}>{p.value || '—'}</Typography> },
    {
      field: 'current_stock',
      headerName: 'Current Stock',
      flex: 0.9,
      type: 'number',
      align: 'right',
      headerAlign: 'right',
      renderCell: (params) => (
        <Typography variant="body2" fontWeight={600} color={params.row.is_low_stock ? 'error.main' : 'inherit'}>{params.value}</Typography>
      ),
    },
    { field: 'min_stock', headerName: 'Min Stock', flex: 0.7, type: 'number', align: 'right', headerAlign: 'right' },
    {
      field: '_level',
      headerName: 'Level',
      flex: 1.2,
      sortable: false,
      renderCell: (params) => {
        const pct = params.row.min_stock > 0 ? Math.min((params.row.current_stock / params.row.min_stock) * 50, 100) : 100;
        return (
          <LinearProgress
            variant="determinate"
            value={Math.min(pct, 100)}
            sx={{
              width: '100%', height: 6, borderRadius: 3, bgcolor: 'grey.200',
              '& .MuiLinearProgress-bar': { bgcolor: params.row.is_low_stock ? '#F44336' : '#4CAF50', borderRadius: 3 },
            }}
          />
        );
      },
    },
    { field: 'stock_value', headerName: 'Value', flex: 0.8, type: 'number', align: 'right', headerAlign: 'right', valueFormatter: (v: number) => formatCurrency(v) },
  ];

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h5" fontWeight={700}>Inventory Management</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="contained" startIcon={<Add />} onClick={() => setAddOpen(true)}>Add Product</Button>
        </Box>
      </Box>

      {lowStockCount > 0 && (
        <Alert severity="warning" icon={<Warning />} sx={{ mb: 2, borderRadius: 2 }}>
          <strong>{lowStockCount} products</strong> are below minimum stock level. Consider restocking.
        </Alert>
      )}

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={tab} onChange={(_, vl) => setTab(vl)}>
          <Tab label="Products" />
          <Tab label={`Stock Levels${lowStockCount > 0 ? ` (${lowStockCount} low)` : ''}`} />
          <Tab label="Purchase Orders" />
        </Tabs>
      </Box>

      {tab === 0 && (
        <Card>
          <Box sx={{ p: 2 }}>
            <TextField
              placeholder="Search products by name, SKU, barcode…"
              size="small"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              sx={{ minWidth: 320 }}
              InputProps={{ startAdornment: <InputAdornment position="start"><Search sx={{ fontSize: 18 }} /></InputAdornment> }}
            />
          </Box>
          <DataGrid
            rows={products?.items ?? []}
            columns={productColumns}
            getRowId={(row) => row.product_id}
            loading={prodLoading}
            autoHeight
            pageSizeOptions={[25, 50]}
            initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
            disableRowSelectionOnClick
            slots={{ noRowsOverlay: () => <NoRowsOverlay message="No products found" subtext='Click "Add Product" to create your first product' icon={<Inventory2Icon />} /> }}
            sx={{ border: 0, '& .MuiDataGrid-columnHeaders': { bgcolor: 'grey.50' } }}
          />
        </Card>
      )}

      {tab === 1 && (
        <Card>
          <Box sx={{ p: 2.5 }}>
            <Grid container spacing={2} mb={2}>
              {[
                { label: 'Total Products', value: stock?.total || 0, color: '#6C3FC5' },
                { label: 'Low Stock', value: lowStockCount, color: '#F44336' },
              ].map((s) => (
                <Grid item xs={6} sm={3} key={s.label}>
                  <Box sx={{ p: 2, bgcolor: `${s.color}10`, borderRadius: 2, textAlign: 'center' }}>
                    <Typography variant="h4" fontWeight={800} sx={{ color: s.color }}>{s.value}</Typography>
                    <Typography variant="caption" color="text.secondary">{s.label}</Typography>
                  </Box>
                </Grid>
              ))}
            </Grid>
          </Box>
          <DataGrid
            rows={stock?.items ?? []}
            columns={stockColumns}
            getRowId={(row) => row.inventory_id}
            loading={stockLoading}
            autoHeight
            pageSizeOptions={[25, 50]}
            initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
            disableRowSelectionOnClick
            slots={{ noRowsOverlay: () => <NoRowsOverlay message="No stock records" subtext="Stock levels will appear after products are added" icon={<Inventory2Icon />} /> }}
            sx={{ border: 0, '& .MuiDataGrid-columnHeaders': { bgcolor: 'grey.50' } }}
          />
        </Card>
      )}

      {tab === 2 && (
        <Card sx={{ p: 1 }}>
          <ComingSoon
            compact
            title="Purchase Orders"
            description="Manage supplier purchase orders, track incoming stock, and automate reorder points directly from inventory."
            eta="Q3 2026"
            features={['Supplier Management', 'PO Creation & Approval', 'Receiving & GRN', 'Reorder Alerts', 'Cost Tracking']}
          />
        </Card>
      )}

      {/* Add Product Dialog */}
      <Dialog open={addOpen} onClose={handleClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle>Add Product</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          {submitError && <Alert severity="error" sx={{ mt: 1, mb: 1 }}>{submitError}</Alert>}
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12}>
              <TextField
                label="Product Name *"
                fullWidth
                value={productForm.product_name}
                onChange={(e) => handleChange('product_name', e.target.value)}
                onBlur={() => handleBlur('product_name')}
                error={touched.product_name && !!fieldErrors.product_name}
                helperText={touched.product_name ? fieldErrors.product_name : ''}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                label="SKU / Barcode"
                fullWidth
                value={productForm.sku}
                onChange={(e) => handleChange('sku', e.target.value)}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                label="Tax %"
                fullWidth
                type="number"
                value={productForm.tax_percent}
                onChange={(e) => handleChange('tax_percent', e.target.value)}
                onBlur={() => handleBlur('tax_percent')}
                error={touched.tax_percent && !!fieldErrors.tax_percent}
                helperText={touched.tax_percent ? fieldErrors.tax_percent : ''}
                inputProps={{ min: 0, max: 100, step: 0.5 }}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                label="Cost Price"
                fullWidth
                type="number"
                value={productForm.cost_price}
                onChange={(e) => handleChange('cost_price', e.target.value)}
                onBlur={() => handleBlur('cost_price')}
                error={touched.cost_price && !!fieldErrors.cost_price}
                helperText={touched.cost_price ? fieldErrors.cost_price : ''}
                inputProps={{ min: 0, step: 0.01 }}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                label="Sale Price *"
                fullWidth
                type="number"
                value={productForm.sale_price}
                onChange={(e) => handleChange('sale_price', e.target.value)}
                onBlur={() => handleBlur('sale_price')}
                error={touched.sale_price && !!fieldErrors.sale_price}
                helperText={touched.sale_price ? fieldErrors.sale_price : ''}
                inputProps={{ min: 0.01, step: 0.01 }}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Description"
                fullWidth
                multiline
                rows={2}
                value={productForm.description}
                onChange={(e) => handleChange('description', e.target.value)}
              />
            </Grid>
            <Grid item xs={6}>
              <FormControlLabel
                control={<Switch checked={productForm.is_for_sale} onChange={(e) => setProductForm({ ...productForm, is_for_sale: e.target.checked })} />}
                label="Available for Sale"
              />
            </Grid>
            <Grid item xs={6}>
              <FormControlLabel
                control={<Switch checked={productForm.is_for_use} onChange={(e) => setProductForm({ ...productForm, is_for_use: e.target.checked })} />}
                label="Used in Services"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleClose}>Cancel</Button>
          <Button variant="contained" onClick={handleAddProduct} disabled={creating}>
            {creating ? 'Adding…' : 'Add Product'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
