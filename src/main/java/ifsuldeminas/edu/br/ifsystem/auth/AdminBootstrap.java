package ifsuldeminas.edu.br.ifsystem.auth;

import ifsuldeminas.edu.br.ifsystem.usuario.domain.Perfil;
import ifsuldeminas.edu.br.ifsystem.usuario.repository.UsuarioRepository;
import ifsuldeminas.edu.br.ifsystem.usuario.service.UsuarioService;
import ifsuldeminas.edu.br.ifsystem.usuario.api.UsuarioDtos.CriarUsuario;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(name="app.bootstrap.enabled", havingValue="true")
public class AdminBootstrap implements ApplicationRunner {
    private final UsuarioRepository repository;
    private final UsuarioService service;
    private final String cpf, email, password;
    public AdminBootstrap(UsuarioRepository repository, UsuarioService service,
            @Value("${app.bootstrap.cpf:}") String cpf,
            @Value("${app.bootstrap.email:}") String email,
            @Value("${app.bootstrap.password:}") String password) {
        this.repository=repository; this.service=service; this.cpf=cpf; this.email=email; this.password=password;
    }
    @Override public void run(ApplicationArguments args) {
        if (repository.existsByPerfil(Perfil.ADMINISTRADOR)) return;
        if (cpf.isBlank() || email.isBlank() || password.length()<12)
            throw new IllegalStateException("Configure bootstrap CPF, institutional email and password with at least 12 characters");
        service.criar(new CriarUsuario("Administrador", cpf, email, "admin-"+cpf, password,
                null,null,null), Perfil.ADMINISTRADOR);
    }
}
