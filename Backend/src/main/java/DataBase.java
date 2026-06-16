import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;

import java.sql.SQLException;
import java.sql.Statement;

public class DataBase {
    private static HikariDataSource dataSource;
    private static Statement statement;
    public DataBase(){
        HikariConfig config = new HikariConfig();
        String currentDir = System.getProperty("usr.dir");
        config.setJdbcUrl("jdbc:sqlite:" + currentDir + "/src/resources/data.db"); // test path
        config.setMaximumPoolSize(1);
        config.setPoolName("SQLite-pool");
        config.setAutoCommit(true);

        dataSource = new HikariDataSource(config);
        try {
            statement = dataSource.getConnection().createStatement();
        }catch(SQLException e){
            e.printStackTrace();
        }
    }
}
