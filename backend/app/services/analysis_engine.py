import pandas as pd
import numpy as np
from sklearn.cluster import KMeans

class CANAnalysisEngine:

    def load_csv(self, file_path: str):
        df = pd.read_csv(file_path)
        return df

    def basic_view(self, df):
        id_counts = df["ID"].value_counts().to_dict()

        return {
            "total_messages": len(df),
            "unique_ids": df["ID"].nunique(),
            "id_frequency": id_counts
        }

    def detect_anomalies(self, df):
        anomalies = []

        if "Data" in df.columns:
            df["data_len"] = df["Data"].astype(str).apply(len)
            mean_len = df["data_len"].mean()
            std_len = df["data_len"].std()

            threshold = mean_len + 3 * std_len
            anomaly_rows = df[df["data_len"] > threshold]

            for _, row in anomaly_rows.iterrows():
                anomalies.append({
                    "id": row["ID"],
                    "data": row["Data"],
                    "reason": "Unusually long data payload"
                })

        return {
            "anomalies_detected": len(anomalies),
            "anomalies": anomalies
        }

    def cluster_ids(self, df):
        id_counts = df["ID"].value_counts().reset_index()
        id_counts.columns = ["ID", "count"]

        if len(id_counts) < 3:
            return {"clusters": []}

        kmeans = KMeans(n_clusters=3, n_init="auto")
        id_counts["cluster"] = kmeans.fit_predict(id_counts[["count"]])

        clusters = id_counts.to_dict(orient="records")
        return {"clusters": clusters}

    def infer_behavior(self, df):
        possible_speed = []
        possible_rpm = []
        possible_pedal = []

        for id_val in df["ID"].unique():
            subset = df[df["ID"] == id_val]

            if "Data" not in subset.columns:
                continue

            lengths = subset["Data"].astype(str).apply(len).unique()

            if 2 in lengths:
                possible_speed.append(id_val)

            if 4 in lengths:
                possible_rpm.append(id_val)

            if 1 in lengths:
                possible_pedal.append(id_val)

        return {
            "possible_speed_ids": possible_speed,
            "possible_rpm_ids": possible_rpm,
            "possible_pedal_ids": possible_pedal
        }

    def run_full_analysis(self, file_path: str):
        df = self.load_csv(file_path)

        return {
            "summary": "CAN log analysis completed successfully.",
            "basic_view": self.basic_view(df),
            "diagnostics": self.detect_anomalies(df),
            "reverse_engineering": self.cluster_ids(df),
            "vehicle_behavior": self.infer_behavior(df),
            "signals_detected": df["ID"].nunique()
        }
