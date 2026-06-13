export default function SecurityHistoryScreen({ visitPasses }) {
  return (
    <>
      <header className="dashboard-header visit-header">
        <div>
          <h1>Historial</h1>
          <p>Registro histórico de ingresos validados por seguridad</p>
        </div>
      </header>

      <section className="visit-security-card visit-history-card">
        <table className="visit-history-table">
          <thead>
            <tr>
              <th>Visitante</th>
              <th>Cédula</th>
              <th>Propiedad</th>
              <th>Tipo</th>
              <th>Placa</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {visitPasses.map((item) => (
              <tr key={item.id}>
                <td>{item.fullName}</td>
                <td>{item.idNumber}</td>
                <td>{item.property}</td>
                <td>{item.mode === "vehicular" ? "Vehicular" : "Peatonal"}</td>
                <td>{item.plate}</td>
                <td>{item.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
