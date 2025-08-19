export default function AdminHealthPage() {
  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>Admin Service Health Check</h1>
      <p><strong>Status:</strong> OK</p>
      <p><strong>Port:</strong> 3002</p>
      <p><strong>Service:</strong> OptiOil-Admin</p>
      <p><strong>Time:</strong> {new Date().toISOString()}</p>
    </div>
  )
}