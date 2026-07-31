import api from './api';

/**
 * Devices Service
 * Real device (camera/terminal) activity — derived from every request a
 * device has actually made, not a manually configured list. Powers
 * Monitoring > Terminallar.
 */
export const devicesService = {
  async getTerminals() {
    const response = await api.get('/devices/terminals');
    return response.data.data;
  },
};

export default devicesService;
