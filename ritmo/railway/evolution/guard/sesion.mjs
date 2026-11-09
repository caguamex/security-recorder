// Un solo motor abre los dispositivos. Los reinicios conservan las credenciales en PostgreSQL.
export class CustodioSesion {
  constructor(db,{propietario,despliegue}) { this.db=db;this.propietario=propietario;this.despliegue=despliegue;this.fence=null; }
  async preparar() {
    await this.db.query(`CREATE TABLE IF NOT EXISTS agendappx_evolution.agendappx_runtime (
      id integer PRIMARY KEY CHECK(id=1), propietario uuid, despliegue text,
      vence_en timestamptz, fence bigint NOT NULL DEFAULT 0, solicitud uuid, solicitado_en timestamptz
    )`);
    await this.db.query('REVOKE ALL ON agendappx_evolution.agendappx_runtime FROM PUBLIC, anon, authenticated, ritmo_api');
    await this.db.query('INSERT INTO agendappx_evolution.agendappx_runtime(id) VALUES(1) ON CONFLICT DO NOTHING');
  }
  async adquirir() {
    const r=await this.db.query(`UPDATE agendappx_evolution.agendappx_runtime SET propietario=$1,despliegue=$2,
      vence_en=clock_timestamp()+interval '45 seconds',fence=fence+1,solicitud=NULL,solicitado_en=NULL
      WHERE id=1 AND (propietario IS NULL OR vence_en<=clock_timestamp())
      AND (solicitud IS NULL OR solicitud=$1 OR solicitado_en<clock_timestamp()-interval '60 seconds') RETURNING fence`,
    [this.propietario,this.despliegue]);
    if(r.rows[0]) { this.fence=r.rows[0].fence;return true; }
    // Dos réplicas del mismo despliegue no se expulsan entre sí. Una publicación nueva
    // solicita la salida ordenada del anterior antes de abrir su propia conexión.
    await this.db.query(`UPDATE agendappx_evolution.agendappx_runtime SET solicitud=$1,solicitado_en=clock_timestamp()
      WHERE id=1 AND despliegue IS DISTINCT FROM $2 AND propietario IS DISTINCT FROM $1
      AND (solicitud IS NULL OR solicitado_en<clock_timestamp()-interval '60 seconds')`,[this.propietario,this.despliegue]);
    return false;
  }
  async renovar() {
    if(this.fence===null)return false;
    const r=await this.db.query(`UPDATE agendappx_evolution.agendappx_runtime SET vence_en=clock_timestamp()+interval '45 seconds'
      WHERE id=1 AND propietario=$1 AND fence=$2 AND vence_en>clock_timestamp()
      AND (solicitud IS NULL OR solicitud=$1) RETURNING id`,[this.propietario,this.fence]);
    return r.rows.length===1;
  }
  async liberar() {
    if(this.fence===null)return;
    await this.db.query(`UPDATE agendappx_evolution.agendappx_runtime SET propietario=NULL,vence_en=NULL
      WHERE id=1 AND propietario=$1 AND fence=$2`,[this.propietario,this.fence]);
    this.fence=null;
  }
}
