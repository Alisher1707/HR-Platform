import React, { useState } from 'react';
import {
  Plus,
  ScanFace,
  Wifi,
  WifiOff,
  Loader2,
  Trash2,
  Pencil,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Info,
  CheckCircle2,
} from 'lucide-react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';
import EmptyState from '../../components/ui/EmptyState';
import useToast from '../../hooks/useToast';

// Backend hali ulanmagan — qurilmalar ro'yxati faqat shu sahifa ochiq
// turgan sessiyada, brauzer xotirasida saqlanadi (boshqa prototip
// bo'limlar — Jazo turlari, Jadval — bilan bir xil daraja).

const DEVICE_MODELS = ['DS-K1T671M', 'DS-K1T342E'];

function getDefaultDeviceForm() {
  return {
    deviceId: '',
    name: '',
    ip: '',
    port: '80',
    model: DEVICE_MODELS[0],
    username: 'admin',
    password: '',
  };
}

function DeviceStatusBadge({ status }) {
  if (status === 'connecting') {
    return (
      <span className="status-badge status-connecting">
        <Loader2 size={12} strokeWidth={2.5} className="devices-spin" />
        Ulanmoqda...
      </span>
    );
  }
  if (status === 'connected') {
    return (
      <span className="status-badge status-connected">
        <Wifi size={12} strokeWidth={2.5} />
        Ulangan
      </span>
    );
  }
  if (status === 'error') {
    return (
      <span className="status-badge status-error">
        <AlertTriangle size={12} strokeWidth={2.5} />
        Xato
      </span>
    );
  }
  return (
    <span className="status-badge status-disconnected">
      <WifiOff size={12} strokeWidth={2.5} />
      Ulanmagan
    </span>
  );
}

const TROUBLESHOOT_ITEMS = [
  "Qurilma IP-manzili to'g'ri va tarmoqda ko'rinadi",
  'Port to‘g‘ri kiritilgan (odatda 80)',
  "Login/parol — qurilmaning Hikvision admin hisobi",
  'Server qurilma tarmoqidan ko‘rina oladi',
  "Qurilma firmware'i DS-K1T671M v1.1.0+ bo'lishi kerak",
  'Kirish loglari sahifasida event umuman kelyaptimi?',
];

export function DevicesPage() {
  const { toast } = useToast();
  const [devices, setDevices] = useState([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingDevice, setEditingDevice] = useState(null);
  const [form, setForm] = useState(getDefaultDeviceForm());
  const [connectingId, setConnectingId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isHelpOpen, setIsHelpOpen] = useState(true);

  const handleFieldChange = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const openCreate = () => {
    setEditingDevice(null);
    setForm(getDefaultDeviceForm());
    setIsFormOpen(true);
  };

  const openEdit = (device) => {
    setEditingDevice(device);
    setForm({
      deviceId: device.deviceId,
      name: device.name,
      ip: device.ip,
      port: device.port,
      model: device.model,
      username: device.username,
      password: '',
    });
    setIsFormOpen(true);
  };

  const closeForm = () => setIsFormOpen(false);

  const handleSave = () => {
    if (!form.deviceId.trim() || !form.name.trim() || !form.ip.trim()) {
      toast.error("Qurilma ID, nomi va IP-manzil kiritilishi shart");
      return;
    }

    if (editingDevice) {
      setDevices((prev) =>
        prev.map((d) => (d.id === editingDevice.id ? { ...d, ...form } : d))
      );
      toast.success("Qurilma ma'lumotlari yangilandi");
    } else {
      setDevices((prev) => [
        ...prev,
        { id: `dev-${Date.now()}`, ...form, status: 'disconnected' },
      ]);
      toast.success("Qurilma qo'shildi. Endi jadvaldagi \"Webhook ulash\" tugmasini bosing");
    }
    setIsFormOpen(false);
  };

  const handleConnectWebhook = (device) => {
    setConnectingId(device.id);
    setTimeout(() => {
      setDevices((prev) =>
        prev.map((d) => (d.id === device.id ? { ...d, status: 'connected' } : d))
      );
      setConnectingId(null);
      toast.success(`"${device.name}" qurilmasiga webhook manzili yozildi`);
    }, 900);
  };

  const handleDeleteConfirm = () => {
    setDevices((prev) => prev.filter((d) => d.id !== deleteTarget.id));
    toast.success("Qurilma o'chirildi");
    setDeleteTarget(null);
  };

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div className="page-header-left">
          <h2 className="page-title">Qurilmalar</h2>
          <p className="page-subtitle">
            Yuzni tanish qurilmalari (Hikvision) — ulanish va avtomatik davomat sozlamalari.
          </p>
        </div>
        <div className="page-header-right">
          <Button
            variant="primary"
            className="attendance-primary-btn"
            icon={<Plus size={16} strokeWidth={2.5} />}
            onClick={openCreate}
          >
            Yangi qurilma
          </Button>
        </div>
      </div>

      <Card className="mb-6" style={{ padding: 0 }}>
        {devices.length === 0 ? (
          <EmptyState
            title="Qurilmalar qo'shilmagan"
            text="Yuzni tanish orqali avtomatik davomat yuritish uchun birinchi qurilmani qo'shing."
            icon={<ScanFace size={40} strokeWidth={1.5} />}
            action={
              <Button variant="primary" className="attendance-primary-btn" onClick={openCreate}>
                Yangi qurilma
              </Button>
            }
          />
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Qurilma ID</th>
                  <th>Nomi</th>
                  <th>IP : Port</th>
                  <th>Model</th>
                  <th>Holat</th>
                  <th>Amallar</th>
                </tr>
              </thead>
              <tbody>
                {devices.map((d) => (
                  <tr key={d.id}>
                    <td>{d.deviceId}</td>
                    <td>{d.name}</td>
                    <td>{d.ip}:{d.port}</td>
                    <td>{d.model}</td>
                    <td>
                      <DeviceStatusBadge status={connectingId === d.id ? 'connecting' : d.status} />
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleConnectWebhook(d)}
                          disabled={connectingId === d.id}
                        >
                          Webhook ulash
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="btn-icon"
                          onClick={() => openEdit(d)}
                          title="Tahrirlash"
                        >
                          <Pencil size={15} strokeWidth={2} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="btn-icon"
                          onClick={() => setDeleteTarget(d)}
                          title="O'chirish"
                        >
                          <Trash2 size={15} strokeWidth={2} />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card className="devices-help-card">
        <button
          type="button"
          className="devices-help-header"
          onClick={() => setIsHelpOpen((prev) => !prev)}
        >
          <span className="devices-help-header-title">
            <Info size={16} strokeWidth={2.25} />
            Qanday ishlaydi va nosozliklarni bartaraf etish
          </span>
          {isHelpOpen ? <ChevronUp size={16} strokeWidth={2.25} /> : <ChevronDown size={16} strokeWidth={2.25} />}
        </button>

        {isHelpOpen && (
          <div className="devices-help-body">
            <div className="devices-help-steps">
              <div className="devices-help-step">
                <span className="fine-step-badge">1</span>
                <div>
                  <strong>Qurilmani qo'shing</strong>
                  <p>Yuqoridagi "Yangi qurilma" tugmasi orqali ID, nomi, IP-manzil, port va qurilmaning Hikvision login/parolini kiriting.</p>
                </div>
              </div>
              <div className="devices-help-step">
                <span className="fine-step-badge">2</span>
                <div>
                  <strong>Webhook manzilini ulang</strong>
                  <p>Jadvaldagi "Webhook ulash" tugmasi bosilsa, tizim qurilmaga o'zi ulanib, voqea (event) sodir bo'lganda xabar yuborish manzilini yozadi.</p>
                </div>
              </div>
              <div className="devices-help-step">
                <span className="fine-step-badge">3</span>
                <div>
                  <strong>Xodim yuzi avtomatik yuklanadi</strong>
                  <p>Xodim kartasiga rasm biriktirilganda, tizim fonda yuzni qurilmaga o'zi yuboradi — qo'shimcha amal shart emas.</p>
                </div>
              </div>
            </div>

            <div className="devices-help-ready">
              <CheckCircle2 size={16} strokeWidth={2.25} />
              <span>
                Tayyor bo'lgach: xodim qurilma oldidan o'tganda, tizim uni taniydi, davomat yozuvini avtomatik yaratadi va kirish vaqtini "Davomat" bo'limida ko'rsatadi.
              </span>
            </div>

            <div className="devices-help-troubleshoot">
              <span className="devices-help-troubleshoot-title">Ishlamasa, shularni birma-bir tekshiring:</span>
              <ul>
                {TROUBLESHOOT_ITEMS.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </Card>

      <Modal
        isOpen={isFormOpen}
        onClose={closeForm}
        title={editingDevice ? "Qurilmani tahrirlash" : "Yangi qurilma qo'shish"}
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={closeForm}>
              Bekor qilish
            </Button>
            <Button variant="primary" onClick={handleSave}>
              Saqlash
            </Button>
          </>
        }
      >
        <div className="candidate-form-grid">
          <Input
            label="Qurilma ID"
            name="deviceId"
            placeholder="GATE-001"
            value={form.deviceId}
            onChange={handleFieldChange('deviceId')}
            required
          />
          <Input
            label="Nomi"
            name="name"
            placeholder="Asosiy kirish eshigi"
            value={form.name}
            onChange={handleFieldChange('name')}
            required
          />
          <Input
            label="IP-manzil"
            name="ip"
            placeholder="192.168.1.64"
            value={form.ip}
            onChange={handleFieldChange('ip')}
            required
          />
          <Input
            label="Port"
            name="port"
            placeholder="80"
            value={form.port}
            onChange={handleFieldChange('port')}
          />
          <div className="form-group">
            <label className="form-label">Model</label>
            <select
              name="model"
              value={form.model}
              onChange={handleFieldChange('model')}
              className="form-input"
            >
              {DEVICE_MODELS.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
          <Input
            label="Login"
            name="username"
            placeholder="admin"
            value={form.username}
            onChange={handleFieldChange('username')}
          />
          <div className="form-group form-group-full">
            <Input
              label="Parol"
              type="password"
              name="password"
              placeholder="Qurilma admin paroli"
              value={form.password}
              onChange={handleFieldChange('password')}
            />
          </div>
        </div>
      </Modal>

      {deleteTarget && (
        <div className="modal-overlay" onClick={() => setDeleteTarget(null)}>
          <div className="modal-content modal-sm org-delete-confirm" onClick={(e) => e.stopPropagation()}>
            <div className="org-delete-icon">
              <Trash2 size={26} strokeWidth={1.5} />
              <span className="org-delete-icon-badge">
                <AlertTriangle size={12} strokeWidth={3} />
              </span>
            </div>
            <h3 className="org-delete-title">Qurilmani o'chirish</h3>
            <p className="org-delete-message">
              "{deleteTarget.name}" qurilmasini o'chirishni xohlaysizmi? Bu amalni bekor qilib bo'lmaydi.
            </p>
            <div className="org-delete-actions">
              <Button variant="ghost" onClick={() => setDeleteTarget(null)} style={{ flex: 1 }}>
                Bekor qilish
              </Button>
              <Button variant="danger" onClick={handleDeleteConfirm} style={{ flex: 1 }}>
                O'chirish
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DevicesPage;
