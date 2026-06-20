import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;

public class DataBase {
    private static HikariDataSource dataSource;
    private static Statement statement;
    public DataBase(){
        HikariConfig config = new HikariConfig();
        String userDir = System.getProperty("user.home");
        String dbUrl = "jdbc:sqlite:" + userDir + "/Projects/Closira/Backend/src/resources/data.db";
        config.setJdbcUrl(dbUrl); // test path
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

    public ResultSet getTheSet(String tableName, String... fields){
        StringBuilder request = new StringBuilder("SELECT");
        for(String field : fields){
            request.append(" ").append(field).append(",");
        }
        request.delete(request.length() - 1, request.length()); // delete comma in the end
        request.append(" FROM ").append(tableName);
        try {
            return statement.executeQuery(request.toString());
        }catch(SQLException e){
            e.printStackTrace();
        }
        return null;
    }

    public boolean saveTheSet(String tableName, List<Object> data, String... fields){
        if(data == null || data.isEmpty() || fields == null || (fields.length != data.size()))
            return false;

        StringBuilder request = new StringBuilder("INSERT INTO ").append(tableName).append(" (");
        request.append(String.join(", ", fields));
        request.append(") VALUES (");
        String[] marks = new String[fields.length];
        for(int i = 0; i < marks.length; i++)
            marks[i] = "?";
        request.append(String.join(", ", marks));
        request.append(")");
        try(Connection connection = dataSource.getConnection();
                PreparedStatement statement = connection.prepareStatement(request.toString())){
            for(int i = 0; i < fields.length; i++){
                statement.setString(i + 1, (String) data.get(i));
            }
            return statement.executeUpdate() > 0;
        }catch(SQLException e){
            e.printStackTrace();
            return false;
        }
    }
}
