import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
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
                    <th>Tajriba</th>
                    <th>Holat</th>
                    <th>Telefon</th>
                    <th>Telegram</th>
                    <th>Manzil</th>
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
                      <td>{emp.experience || 0} yil</td>
                      <td>
                        <span className={`status-badge status-${emp.status?.toLowerCase().replace(/['\s]/g, '')}`}>
                          {emp.status || 'Faol'}
                        </span>
                      </td>
                      <td>{emp.phone || 'Yo\'q'}</td>
                      <td>
                        {emp.telegram_username ? (
                          <span style={{ color: 'var(--accent)', fontWeight: '500' }}>
                            {emp.telegram_username}
                          </span>
                        ) : (
                          'Yo\'q'
                        )}
                      </td>
                      <td>
                        <div className="truncate" style={{ maxWidth: '150px' }}>
                          {emp.address || 'Yo\'q'}
                        </div>
                      </td>
                      <td>
                        <div className="table-actions" style={{ justifyContent: 'flex-end' }}>
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
    </div>
  );
}

export default EmployeeList;
