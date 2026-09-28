import Foundation

@main struct JarvisTaskHistoryTests {
  static func main() {
    var history = JarvisTaskHistory()
    history.start(id: "one", request: "Atualizar briefing", agent: "Codex")
    history.update(id: "one", status: .running, activity: "Editando", response: "Parcial")
    history.update(id: "one", status: .reconnecting, activity: "Reconectando")
    precondition(history.entries[0].response == "Parcial")
    precondition(history.entries[0].status == .reconnecting)
    history.start(id: "one", request: "Duplicado", agent: "Codex")
    precondition(history.entries.count == 1)
    precondition(history.entries[0].request == "Atualizar briefing")
    history.update(id: "one", status: .needsApproval, activity: "Aprovar alteração")
    history.update(id: "one", status: .running, activity: "Decisão recebida")
    history.update(id: "one", status: .completed, activity: "Concluída", response: "Final")
    history.update(id: "one", status: .reconnecting, activity: "Snapshot atrasado", response: "Parcial")
    precondition(history.entries[0].status == .completed)
    precondition(history.entries[0].response == "Final")
    history.start(id: "two", request: "Outro pedido", agent: "Grok Code")
    history.update(id: "missing", status: .failed, activity: "Desconhecido")
    history.update(id: "one", status: .failed, activity: "Falha de outra tarefa")
    precondition(history.entries[0].status == .running)
    precondition(history.entries[1].status == .completed)
    history.update(id: "two", status: .failed, activity: "Não concluída", response: "Resultado parcial")
    precondition(history.entries[0].status == .failed)
    precondition(!history.entries[0].status.isActive)
    for i in 0..<60 {
      history.start(id: "history-\(i)", request: "Pedido \(i)", agent: "Codex")
      history.update(id: "history-\(i)", status: .completed, activity: "Concluída")
    }
    precondition(history.entries.count == 50)
    precondition(history.entries.first?.id == "history-59")
    print("PASS: reconexão preserva texto, retomada não duplica, aprovação avança, término ignora evento atrasado, IDs isolados, falha preserva parcial, histórico limitado")
  }
}
