-- Enable realtime for server_deployments table
ALTER PUBLICATION supabase_realtime ADD TABLE public.server_deployments;

-- Set replica identity to full for complete row data
ALTER TABLE public.server_deployments REPLICA IDENTITY FULL;