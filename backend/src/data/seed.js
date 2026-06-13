const bcrypt = require('bcryptjs');

const SEED = {
  usuarios: [
    {
      id: '82a8390b-d0e1-40d6-aa9a-29c83715db2b',
      name: 'Flavia Lozada',
      email: 'flavialozadar@gmail.com',
      password: bcrypt.hashSync('123456', 10),
      role: 'Super Admin',
      phone: '',
      property: '-',
      condo: 'General',
    },
  ],
  condominios:      [],
  propiedades:      [],
  pagos:            [],
  anuncios:         [],
  asambleas:        [],
  visitas:          [],
  historialVisitas: [],
  panicAlerts:      [],
};

module.exports = SEED;
