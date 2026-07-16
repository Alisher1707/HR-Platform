import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import employeeService from '../../services/employeeService';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Input from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import EmptyState from '../../components/ui/EmptyState';
import EmployeeForm from './EmployeeForm';
import useToast from '../../hooks/useToast';

/**
 * EmployeeList Component
 * Table list with pagination, search, create, update and delete capabilities
 */
export function EmployeeList() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
  });

  const [search, setSearch] = useState('');
  const [searchTimeout, setSearchTimeout] = useState(null);
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);

  const fetchEmployees = async (page = 1, searchQuery = '') => {
    setLoading(true);
    try {
      const response = await employeeService.getEmployees({
        page,
        limit: 10,
        search: searchQuery || undefined,
      });

      setEmployees(response.data || []);
      setPagination(response.pagination || {
        page: 1,
        limit: 10,
        total: 0,
        totalPages: 1,
      });
    } catch (err) {
      toast.error('Xodimlarni yuklashda xatolik yuz berdi');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Check if redirect has action=add
    const action = searchParams.get('action');
    if (action === 'add') {
      setIsModalOpen(true);
      // Clear action param so modal doesn't re-open on refresh
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('action');
      setSearchParams(newParams);
    }

    fetchEmployees(1, search);
  }, []);

  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearch(value);

    // Debounce search API calls
    if (searchTimeout) clearTimeout(searchTimeout);
    
    setSearchTimeout(
      setTimeout(() => {
        fetchEmployees(1, value);
      }, 500)
    );
  };

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      fetchEmployees(newPage, search);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Haqiqatan ham ushbu xodim ma\'lumotlarini o\'chirmoqchimisiz? Bu nomzod arizasini ham o\'chirib tashlaydi.')) return;
    
    try {
      await employeeService.deleteEmployee(id);
      toast.success('Xodim ma\'lumotlari muvaffaqiyatli o\'chirildi');
      fetchEmployees(pagination.page, search);
    } catch (err) {
      toast.error('Xodimni o\'chirishda xatolik yuz berdi');
      console.error(err);
    }
  };

  const handleEditClick = (employee) => {
    setEditingEmployee(employee);
    setIsModalOpen(true);
  };

  const handleCreateClick = () => {
    setEditingEmployee(null);
    setIsModalOpen(true);
  };

  const handleFormSuccess = () => {
    setIsModalOpen(false);
    setEditingEmployee(null);
    fetchEmployees(pagination.page, search);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setEditingEmployee(null);
  };

  const handleDetailClick = (employee) => {
    setSelectedEmployee(employee);
    setIsDetailModalOpen(true);
  };

  const handleDetailModalClose = () => {
    setIsDetailModalOpen(false);
    setSelectedEmployee(null);
  };

  const handleEJMClick = (employee) => {
    const token = localStorage.getItem('accessToken');
    const params = new URLSearchParams({
      employeeId: employee.id,
      employeeName: `${employee.first_name} ${employee.last_name}`,
      position: employee.position || '',
      branch: employee.branch || '',
      department: employee.department || '',
      token: token || ''
    });
    window.open(`/ejm.html?${params.toString()}`, '_blank');
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Kiritilmagan';
    const date = new Date(dateString);
    return date.toLocaleDateString('uz-UZ', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  return (
    <div className="animate-fade-in">
      {/* Page Header */}
      <div className="page-header">
        <div className="page-header-left">
          <h2 className="page-title">Xodimlar bo'limi</h2>
          <p className="page-subtitle">Kompaniya xodimlari ro'yxati, qidiruv, yangi xodim qo'shish va tahrirlash.</p>
        </div>
        <div className="page-header-right">
          <Button variant="primary" onClick={handleCreateClick} icon="👤">
            Yangi xodim qo'shish
          </Button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <Card className="mb-6 flex justify-between items-center gap-4 flex-wrap" style={{ padding: '1rem' }}>
        <div className="search-bar w-full" style={{ maxWidth: '400px' }}>
          <span className="search-icon">🔍</span>
          <input
            type="text"
            className="form-input"
            placeholder="Ism, familiya yoki telefon bo'yicha qidirish..."
            value={search}
            onChange={handleSearchChange}
          />
        </div>
      </Card>

      {/* Employees Grid / Table */}
      <Card>
        {loading ? (
          <LoadingSpinner text="Xodimlar ro'yxati yangilanmoqda..." />
        ) : employees.length === 0 ? (
          <EmptyState
            title="Xodimlar topilmadi"
            text={search ? `"${search}" so'rovi bo'yicha hech qanday xodim topilmadi.` : "Kompaniyada xodimlar mavjud emas."}
            icon="👥"
            action={
              !search && (
                <Button variant="primary" onClick={handleCreateClick}>
                  Yangi xodim qo'shish
                </Button>
              )
            }
          />
        ) : (
          <>
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Ism</th>
                    <th>Familiya</th>
                    <th>Filial</th>
                    <th>Bo'lim</th>
                    <th>Lavozim</th>
                    <th>Holat</th>
                    <th>Telefon</th>
                    <th style={{ textAlign: 'right' }}>Amallar</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.map((emp) => (
                    <tr key={emp.id}>
                      <td><div className="font-semibold">{emp.first_name}</div></td>
                      <td><div className="font-semibold">{emp.last_name}</div></td>
                      <td>{emp.branch ? emp.branch.charAt(0).toUpperCase() + emp.branch.slice(1) : 'Yo\'q'}</td>
                      <td>{emp.department ? emp.department.charAt(0).toUpperCase() + emp.department.slice(1) : 'Yo\'q'}</td>
                      <td>{emp.position ? emp.position.charAt(0).toUpperCase() + emp.position.slice(1) : 'Yo\'q'}</td>
                      <td>
                        <span className={`status-badge status-${emp.status?.toLowerCase().replace(/['\s]/g, '')}`}>
                          {emp.status || 'Faol'}
                        </span>
                      </td>
                      <td>{emp.phone || 'Yo\'q'}</td>
                      <td>
                        <div className="table-actions" style={{ justifyContent: 'flex-end', gap: '0.75rem' }}>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDetailClick(emp)}
                            style={{ borderColor: '#ffffff' }}
                          >
                            Batafsil
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEJMClick(emp)}
                            style={{
                              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                              color: 'white',
                              border: 'none',
                              fontWeight: '600'
                            }}
                          >
                            📊 EJM
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => handleEditClick(emp)}>
                            Tahrirlash
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(emp.id)}
                            style={{ color: 'var(--error)' }}
                          >
                            O'chirish
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {pagination.totalPages > 1 && (
              <div className="pagination">
                <button
                  className="pagination-btn"
                  onClick={() => handlePageChange(pagination.page - 1)}
                  disabled={pagination.page === 1}
                >
                  ◀
                </button>
                
                {[...Array(pagination.totalPages)].map((_, i) => (
                  <button
                    key={i}
                    className={`pagination-btn ${pagination.page === i + 1 ? 'active' : ''}`}
                    onClick={() => handlePageChange(i + 1)}
                  >
                    {i + 1}
                  </button>
                ))}

                <button
                  className="pagination-btn"
                  onClick={() => handlePageChange(pagination.page + 1)}
                  disabled={pagination.page === pagination.totalPages}
                >
                  ▶
                </button>
              </div>
            )}
          </>
        )}
      </Card>

      {/* Add / Edit Modal Overlay */}
      <Modal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        title={editingEmployee ? "Xodim ma'lumotlarini tahrirlash" : "Yangi xodim qo'shish"}
        size="lg"
      >
        <EmployeeForm
          employee={editingEmployee}
          onSubmitSuccess={handleFormSuccess}
          onCancel={handleModalClose}
        />
      </Modal>

      {/* Employee Detail Modal */}
      <Modal
        isOpen={isDetailModalOpen}
        onClose={handleDetailModalClose}
        title="Xodim haqida batafsil ma'lumot"
        size="lg"
      >
        {selectedEmployee && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Header Card - Employee Name and Status */}
            <div style={{
              background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
              padding: '1.5rem',
              borderRadius: '12px',
              color: 'white',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)'
            }}>
              <div>
                <h2 style={{ fontSize: '1.5rem', fontWeight: '700', margin: '0 0 0.5rem 0' }}>
                  {selectedEmployee.first_name} {selectedEmployee.last_name}
                </h2>
                <p style={{ fontSize: '0.95rem', opacity: '0.95', margin: 0 }}>
                  {selectedEmployee.position ? selectedEmployee.position.charAt(0).toUpperCase() + selectedEmployee.position.slice(1) : 'Lavozim kiritilmagan'}
                </p>
              </div>
              <div>
                <span style={{
                  background: 'rgba(255, 255, 255, 0.25)',
                  padding: '0.5rem 1rem',
                  borderRadius: '20px',
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  backdropFilter: 'blur(10px)'
                }}>
                  {selectedEmployee.status || 'Faol'}
                </span>
              </div>
            </div>

            {/* Info Grid - 2 columns */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              {/* Shaxsiy ma'lumotlar */}
              <div style={{
                background: 'var(--surface)',
                padding: '1.25rem',
                borderRadius: '10px',
                border: '1px solid var(--border)',
                transition: 'transform 0.2s, box-shadow 0.2s',
              }}>
                <h3 style={{
                  fontSize: '0.875rem',
                  fontWeight: '700',
                  marginBottom: '1rem',
                  color: 'var(--accent)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}>
                  <span style={{ fontSize: '1.1rem' }}>📋</span> Shaxsiy ma'lumotlar
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem', fontWeight: '600' }}>Xodim raqami</label>
                    <div style={{ fontSize: '0.9rem', fontWeight: '500' }}>{selectedEmployee.employee_number || '—'}</div>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem', fontWeight: '600' }}>Tug'ilgan sana</label>
                    <div style={{ fontSize: '0.9rem', fontWeight: '500' }}>{formatDate(selectedEmployee.birth_date)}</div>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem', fontWeight: '600' }}>PNFL</label>
                    <div style={{ fontSize: '0.9rem', fontWeight: '500', fontFamily: 'monospace' }}>{selectedEmployee.pnfl || '—'}</div>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem', fontWeight: '600' }}>Tajriba</label>
                    <div style={{ fontSize: '0.9rem', fontWeight: '500' }}>
                      {selectedEmployee.experience ? (
                        <span style={{ color: 'var(--accent)' }}>{selectedEmployee.experience} yil</span>
                      ) : '—'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Aloqa ma'lumotlari */}
              <div style={{
                background: 'var(--surface)',
                padding: '1.25rem',
                borderRadius: '10px',
                border: '1px solid var(--border)',
                transition: 'transform 0.2s, box-shadow 0.2s',
              }}>
                <h3 style={{
                  fontSize: '0.875rem',
                  fontWeight: '700',
                  marginBottom: '1rem',
                  color: 'var(--accent)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}>
                  <span style={{ fontSize: '1.1rem' }}>📞</span> Aloqa
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem', fontWeight: '600' }}>Telefon</label>
                    <div style={{ fontSize: '0.9rem', fontWeight: '500', fontFamily: 'monospace' }}>{selectedEmployee.phone || '—'}</div>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem', fontWeight: '600' }}>Email</label>
                    <div style={{ fontSize: '0.9rem', fontWeight: '500', wordBreak: 'break-all' }}>{selectedEmployee.email || '—'}</div>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem', fontWeight: '600' }}>Telegram</label>
                    <div style={{ fontSize: '0.9rem', fontWeight: '500', color: 'var(--accent)' }}>
                      {selectedEmployee.telegram_username || '—'}
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem', fontWeight: '600' }}>Manzil</label>
                    <div style={{ fontSize: '0.9rem', fontWeight: '500' }}>{selectedEmployee.address || '—'}</div>
                  </div>
                </div>
              </div>

              {/* Ish ma'lumotlari */}
              <div style={{
                background: 'var(--surface)',
                padding: '1.25rem',
                borderRadius: '10px',
                border: '1px solid var(--border)',
                transition: 'transform 0.2s, box-shadow 0.2s',
              }}>
                <h3 style={{
                  fontSize: '0.875rem',
                  fontWeight: '700',
                  marginBottom: '1rem',
                  color: 'var(--accent)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}>
                  <span style={{ fontSize: '1.1rem' }}>💼</span> Ish ma'lumotlari
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem', fontWeight: '600' }}>Filial</label>
                    <div style={{ fontSize: '0.9rem', fontWeight: '500' }}>
                      {selectedEmployee.branch ? selectedEmployee.branch.charAt(0).toUpperCase() + selectedEmployee.branch.slice(1) : '—'}
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem', fontWeight: '600' }}>Bo'lim</label>
                    <div style={{ fontSize: '0.9rem', fontWeight: '500' }}>
                      {selectedEmployee.department ? selectedEmployee.department.charAt(0).toUpperCase() + selectedEmployee.department.slice(1) : '—'}
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem', fontWeight: '600' }}>Ishga kirgan sana</label>
                    <div style={{ fontSize: '0.9rem', fontWeight: '500' }}>{formatDate(selectedEmployee.join_date)}</div>
                  </div>
                </div>
              </div>

              {/* Maosh va KPI */}
              <div style={{
                background: 'var(--surface)',
                padding: '1.25rem',
                borderRadius: '10px',
                border: '1px solid var(--border)',
                transition: 'transform 0.2s, box-shadow 0.2s',
              }}>
                <h3 style={{
                  fontSize: '0.875rem',
                  fontWeight: '700',
                  marginBottom: '1rem',
                  color: 'var(--accent)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}>
                  <span style={{ fontSize: '1.1rem' }}>💰</span> Maosh va KPI
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem', fontWeight: '600' }}>Maosh turi</label>
                    <div style={{ fontSize: '0.9rem', fontWeight: '500' }}>{selectedEmployee.salary_type || '—'}</div>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem', fontWeight: '600' }}>Maosh miqdori</label>
                    <div style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--success)' }}>
                      {selectedEmployee.salary_amount ? `${selectedEmployee.salary_amount.toLocaleString('uz-UZ')} UZS` : '—'}
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem', fontWeight: '600' }}>KPI Shablon</label>
                    <div style={{ fontSize: '0.9rem', fontWeight: '500' }}>{selectedEmployee.kpi_template || '—'}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Tizim ma'lumotlari - Full Width */}
            <div style={{
              background: 'var(--surface)',
              padding: '1rem 1.25rem',
              borderRadius: '10px',
              border: '1px solid var(--border)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '1rem'
            }}>
              <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
                <div>
                  <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem', fontWeight: '600' }}>YARATILGAN</label>
                  <div style={{ fontSize: '0.85rem', fontWeight: '500' }}>{formatDate(selectedEmployee.created_at)}</div>
                </div>
                <div>
                  <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem', fontWeight: '600' }}>YANGILANGAN</label>
                  <div style={{ fontSize: '0.85rem', fontWeight: '500' }}>{formatDate(selectedEmployee.updated_at)}</div>
                </div>
                {selectedEmployee.created_by && (
                  <div>
                    <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem', fontWeight: '600' }}>YARATUVCHI</label>
                    <div style={{ fontSize: '0.85rem', fontWeight: '500' }}>
                      {selectedEmployee.created_by.first_name} {selectedEmployee.created_by.last_name}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', paddingTop: '0.5rem' }}>
              <Button
                variant="outline"
                onClick={() => { handleDetailModalClose(); handleEJMClick(selectedEmployee); }}
                style={{
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: 'white',
                  border: 'none',
                  fontWeight: '600'
                }}
              >
                📊 EJM
              </Button>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <Button variant="outline" onClick={handleDetailModalClose}>
                  Yopish
                </Button>
                <Button variant="primary" onClick={() => { handleDetailModalClose(); handleEditClick(selectedEmployee); }}>
                  ✏️ Tahrirlash
                </Button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

export default EmployeeList;
