import AbstractService from "../AbstractService.js";
import { ApiError } from "../../utils/ApiError.js";

export default class AcordeCustomizadoService extends AbstractService {
  constructor(acordeCustomizadoRepository) {
    super(acordeCustomizadoRepository);
  }

  criar(usuarioId, dados) {
    return this.repository.create({ ...dados, usuarioId });
  }

  listar(usuarioId) {
    return this.repository.listByUsuario(usuarioId);
  }

  async obterOuFalhar(id, usuarioId) {
    const acorde = await this.repository.findByIdAndUsuario(id, usuarioId);
    if (!acorde) throw ApiError.notFound("Acorde customizado não encontrado.");
    return acorde;
  }

  async atualizar(id, usuarioId, dados) {
    await this.obterOuFalhar(id, usuarioId);
    return this.repository.update(id, dados);
  }

  async excluir(id, usuarioId) {
    await this.obterOuFalhar(id, usuarioId);
    await this.repository.delete(id);
  }
}
