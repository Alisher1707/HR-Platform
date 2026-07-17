import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import applicationService from '../services/applicationService';
import useToast from './useToast';

/**
 * useKanban Hook
 * Wraps react-query logic for managing applications on the Kanban board
 */
export function useKanban(filters = {}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch applications
  const { 
    data: applications = [], 
    isLoading, 
    isError, 
    refetch 
  } = useQuery({
    queryKey: ['applications', filters],
    queryFn: () => applicationService.getApplications(filters),
  });

  // Mutation to update application status
  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status, comment, interviewDate }) =>
      applicationService.updateApplicationStatus(id, status, comment, interviewDate),
    onSuccess: (data) => {
      toast.success('Nomzod holati muvaffaqiyatli yangilandi');
      // Invalidate queries to trigger re-fetch
      queryClient.invalidateQueries({ queryKey: ['applications'] });
    },
    onError: (err) => {
      const errorMsg = err.response?.data?.message || 'Nomzod holatini yangilashda xatolik yuz berdi';
      toast.error(errorMsg);
      console.error(err);
    }
  });

  // Mutation to update general application details
  const updateDetailsMutation = useMutation({
    mutationFn: ({ id, data }) => 
      applicationService.updateApplication(id, data),
    onSuccess: () => {
      toast.success('Ariza muvaffaqiyatli saqlandi');
      queryClient.invalidateQueries({ queryKey: ['applications'] });
    },
    onError: (err) => {
      const errorMsg = err.response?.data?.message || 'Arizani yangilashda xatolik yuz berdi';
      toast.error(errorMsg);
      console.error(err);
    }
  });

  return {
    applications,
    isLoading,
    isError,
    refetch,
    updateStatus: updateStatusMutation.mutateAsync,
    isUpdatingStatus: updateStatusMutation.isPending,
    updateDetails: updateDetailsMutation.mutateAsync,
    isUpdatingDetails: updateDetailsMutation.isPending,
  };
}

export default useKanban;
