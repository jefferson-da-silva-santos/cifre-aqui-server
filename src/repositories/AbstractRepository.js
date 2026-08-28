export default class AbstractRepository {
  constructor(prisma, modelName) {
    this.prisma = prisma;
    this.model = prisma[modelName];
  }

  create(data) {
    return this.model.create({ data });
  }

  findById(id, opts = {}) {
    return this.model.findUnique({ where: { id }, ...opts });
  }

  findFirst(where, opts = {}) {
    return this.model.findFirst({ where, ...opts });
  }

  findMany(where = {}, opts = {}) {
    return this.model.findMany({ where, ...opts });
  }

  update(id, data) {
    return this.model.update({ where: { id }, data });
  }

  delete(id) {
    return this.model.delete({ where: { id } });
  }

  count(where = {}) {
    return this.model.count({ where });
  }
}
