import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import employeeService from '../../services/employeeService';
import Button from '../../components/ui/Button';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import useToast from '../../hooks/useToast';

/**
 * EmployeeEJMPage Component
 * Full-page EJM (Employee Journey Map) for a specific employee
 * Displays 48-step journey with file upload/download/preview capabilities
 */
export function EmployeeEJMPage() {
  const { employeeId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const iframeRef = useRef(null);

  const [employee, setEmployee] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEmployee = async () => {
      try {
        const response = await employeeService.getEmployeeById(employeeId);
        setEmployee(response);
      } catch (error) {
        console.error('Error fetching employee:', error);
        toast.error('Xodim ma\'lumotlarini yuklashda xatolik');
        navigate('/admin/employees');
      } finally {
        setLoading(false);
      }
    };

    if (employeeId) {
      fetchEmployee();
    }
  }, [employeeId, navigate, toast]);

  // Send employee data to iframe when it loads
  useEffect(() => {
    if (iframeRef.current && employee) {
      const handleIframeLoad = () => {
        try {
          const iframeWindow = iframeRef.current.contentWindow;

          // Wait a bit for iframe to fully initialize
          setTimeout(() => {
            // Send employee context to iframe
            iframeWindow.postMessage({
              type: 'EMPLOYEE_CONTEXT',
              employeeId: employee.id,
              employeeName: `${employee.first_name} ${employee.last_name}`,
              position: employee.position || 'Lavozim',
              branch: employee.branch || 'Filial',
              department: employee.department || 'Bo\'lim'
            }, '*');

            console.log('Employee context sent to iframe:', {
              employeeId: employee.id,
              name: `${employee.first_name} ${employee.last_name}`
            });
          }, 500);
        } catch (error) {
          console.error('Error sending message to iframe:', error);
        }
      };

      const iframe = iframeRef.current;
      if (iframe.contentDocument && iframe.contentDocument.readyState === 'complete') {
        handleIframeLoad();
      } else {
        iframe.addEventListener('load', handleIframeLoad);
        return () => {
          iframe.removeEventListener('load', handleIframeLoad);
        };
      }
    }
  }, [employee]);

  // Listen for messages from iframe (file preview requests, save requests, etc.)
  useEffect(() => {
    const handleMessage = (event) => {
      // Security: verify origin
      if (!event.origin.includes('localhost') && !event.origin.includes(window.location.hostname)) {
        return;
      }

      console.log('Message received from iframe:', event.data);

      if (event.data.type === 'PREVIEW_FILE') {
        const { fileId, fileName, fileType } = event.data;
        handleFilePreview(fileId, fileName, fileType);
      } else if (event.data.type === 'EJM_LOADED') {
        console.log('EJM HTML loaded successfully');
      } else if (event.data.type === 'FILE_UPLOAD_SUCCESS') {
        console.log('File uploaded successfully:', event.data);
        toast.success(`Fayl muvaffaqiyatli yuklandi`);
      } else if (event.data.type === 'FILE_UPLOAD_ERROR') {
        console.error('File upload error:', event.data.error);
        toast.error(`Fayl yuklashda xatolik: ${event.data.error}`);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [toast]);

  const handleFilePreview = (fileId, fileName, fileType) => {
    const token = localStorage.getItem('accessToken');
    const downloadUrl = `/api/v1/ejm/download/${fileId}?token=${token}`;

    // Determine how to preview based on file type
    if (fileType && fileType.startsWith('image/')) {
      // Images: open in new tab
      window.open(downloadUrl, '_blank');
    } else if (fileType && fileType.startsWith('video/')) {
      // Videos: open in new tab
      window.open(downloadUrl, '_blank');
    } else if (fileType && fileType === 'application/pdf') {
      // PDFs: open in new tab
      window.open(downloadUrl, '_blank');
    } else {
      // Other files: download
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = fileName;
      link.click();
    }
  };

  const handleBack = () => {
    navigate('/admin/employees');
  };

  if (loading) {
    return <LoadingSpinner fullScreen text="EJM yuklanmoqda..." />;
  }

  if (!employee) {
    return null;
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      display: 'flex',
      flexDirection: 'column',
      background: '#f8f9fa',
      zIndex: 1000
    }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        padding: '1.25rem 2rem',
        color: 'white',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div>
          <h1 style={{
            margin: 0,
            fontSize: '1.5rem',
            fontWeight: '700',
            marginBottom: '0.25rem'
          }}>
            {employee.first_name} {employee.last_name} - EJM
          </h1>
          <p style={{
            margin: 0,
            fontSize: '0.95rem',
            opacity: 0.95
          }}>
            {employee.position ? employee.position.charAt(0).toUpperCase() + employee.position.slice(1) : 'Lavozim'} • {' '}
            {employee.branch ? employee.branch.charAt(0).toUpperCase() + employee.branch.slice(1) : 'Filial'} • {' '}
            {employee.department ? employee.department.charAt(0).toUpperCase() + employee.department.slice(1) : 'Bo\'lim'} • {' '}
            📊 48 bosqichli xodim sayohati
          </p>
        </div>
        <Button
          variant="outline"
          onClick={handleBack}
          style={{
            background: 'rgba(255, 255, 255, 0.2)',
            color: 'white',
            border: '1px solid rgba(255, 255, 255, 0.4)',
            backdropFilter: 'blur(10px)',
            fontWeight: '600'
          }}
        >
          ← Orqaga qaytish
        </Button>
      </div>

      {/* EJM Content */}
      <div style={{ flex: 1, overflow: 'hidden', padding: '1rem 2rem' }}>
        <iframe
          ref={iframeRef}
          src="/ejm.html"
          style={{
            width: '100%',
            height: '100%',
            border: '1px solid #e0e0e0',
            borderRadius: '12px',
            background: 'white',
            boxShadow: '0 4px 12px rgba(0,0,0,0.08)'
          }}
          title="Employee Journey Map"
          allow="clipboard-write"
        />
      </div>
    </div>
  );
}

export default EmployeeEJMPage;
